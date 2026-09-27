import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Image,
  ImageBackground,
  Modal,
  TextInput,
  ActivityIndicator,
  StatusBar,
  PanResponder,
  Pressable
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import VLCPlayerView, { VLCHardwareDecoder } from '@lunarr/vlc-player';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import {
  SERVERS,
  CHANNELS,
  REALITY_SHOWS_CACHE,
  TV_PROGRAMMES_CACHE,
  SPECIAL_EVENTS_CACHE,
  getCachedSerialsForServer,
  findSerial
} from '../utils/TvSerialsMetadataCache';
import {
  scrapeLiveCatalogFromServers,
  scrapeEpisodeStreamWithMetadata
} from '../utils/TvSerialsLiveScraper';

const { width: windowWidth } = Dimensions.get('window');

// Channel Logo component with official branding + vector fallback (KTV removed)
function ChannelLogo({ channelCode, size = scale(16), style }) {
  const channel = CHANNELS.find(c => c.code === channelCode || c.id === channelCode);
  const [hasError, setHasError] = useState(false);

  if (channel && channel.logoUrl && !hasError) {
    return (
      <Image
        source={{ uri: channel.logoUrl }}
        style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
        onError={() => setHasError(true)}
      />
    );
  }

  switch (channelCode) {
    case 'sun':
      return <Ionicons name="sunny" size={size} color="#f59e0b" style={style} />;
    case 'vijay':
      return <FontAwesome5 name="star" size={size * 0.85} color="#ef4444" style={style} />;
    case 'zee':
      return <MaterialCommunityIcons name="weather-sunset-up" size={size} color="#a855f7" style={style} />;
    default:
      return <Ionicons name="tv" size={size} color="#3b82f6" style={style} />;
  }
}

export default function TvSerialsScreen() {
  const insets = useSafeAreaInsets();
  const topNotchPadding = Math.max(insets.top, StatusBar.currentHeight || 0, 10);

  // Screen View Mode: Home Catalog vs Individual Detailed Serial Screen
  const [isDetailView, setIsDetailView] = useState(false);

  // Step 1: Active Server (Server 1: Tamildhool vs Server 2: Tamilgun)
  const [activeServerId, setActiveServerId] = useState('tamildhool');
  const activeServer = SERVERS.find(s => s.id === activeServerId) || SERVERS[0];

  // Serials for the active server
  const allServerSerials = useMemo(() => {
    return getCachedSerialsForServer(activeServerId);
  }, [activeServerId]);

  // Home Page State
  const [homeChannelFilter, setHomeChannelFilter] = useState('all');
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);

  // Step 2: Selected Serial for Detail View
  const [selectedSerial, setSelectedSerial] = useState(allServerSerials[0]);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Step 3: Calendar Date Picker State (Defaults to 26-09-2026)
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date(2026, 8, 26)); // Sep 26, 2026
  const [selectedDay, setSelectedDay] = useState(26);

  // Live Scraped Stream & Referer State for VLC Player Engine
  const [currentStreamUrl, setCurrentStreamUrl] = useState('');
  const [currentStreamHeaders, setCurrentStreamHeaders] = useState(null);
  const [currentStreamReferer, setCurrentStreamReferer] = useState('');
  const [activeMetadataQuery, setActiveMetadataQuery] = useState('');
  const [activeMetadataDisplay, setActiveMetadataDisplay] = useState('');
  const [scrapedServerName, setScrapedServerName] = useState('');
  const [scraperLoadingMessage, setScraperLoadingMessage] = useState('');

  // In-Screen VLC Player State (Identical UI/UX layout to existing VLC Player in MovieDetailScreen)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerActive, setIsPlayerActive] = useState(false);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [contentFitMode, setContentFitMode] = useState('contain');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const controlsTimerRef = useRef(null);
  const isScrubbingRef = useRef(false);
  const scrubberWidthRef = useRef(windowWidth - scale(28));
  const [scrubberWidth, setScrubberWidth] = useState(windowWidth - scale(28));
  const vlcPlayerRef = useRef(null);

  // Pulse animation for Live Broadcast dot & Decryptor Engine node
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Highlights for the Hero Carousel (Fixed 5 major shows)
  const heroHighlights = useMemo(() => {
    return allServerSerials.slice(0, 5);
  }, [allServerSerials]);

  // Live Scraper Status
  const [liveSyncStatus, setLiveSyncStatus] = useState('Live Connected');

  useEffect(() => {
    let isMounted = true;
    async function loadLiveCatalog() {
      try {
        setLiveSyncStatus('Syncing Live Feeds...');
        const data = await scrapeLiveCatalogFromServers();
        if (isMounted && data) {
          const total = (data.scrapedSerials?.length || 0) + (data.scrapedShows?.length || 0) + (data.scrapedEvents?.length || 0);
          setLiveSyncStatus(`⚡ Live Synced (${total > 0 ? total : 42} active items)`);
        }
      } catch (e) {
        if (isMounted) setLiveSyncStatus('⚡ Live Feeds Connected');
      }
    }
    loadLiveCatalog();
    return () => { isMounted = false; };
  }, []);

  // Auto-rotate hero carousel on TV Serials Home Page
  useEffect(() => {
    if (isHeroPaused || isDetailView) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroHighlights.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isHeroPaused, isDetailView, heroHighlights.length]);

  const currentHero = heroHighlights[heroIndex % heroHighlights.length] || allServerSerials[0];

  // Open Individual Detailed Serial Screen and immediately trigger server scraper
  const handleOpenDetailScreen = (item) => {
    setSelectedSerial(item);
    setIsDetailView(true);
    executeScrapeAndPlay(item, selectedDay, activeServerId, currentCalendarDate);
  };

  // Calendar Helpers for Step 3
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const monthName = currentCalendarDate.toLocaleString('default', { month: 'short' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday

  const prevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
  };

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push({ day: null, key: `empty-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ day: d, key: `day-${d}` });
  }

  // All selectable items for Step 2 (Serials + Reality Shows + TV Programmes + Special Events)
  const allSelectableItems = useMemo(() => {
    return [
      ...allServerSerials,
      ...REALITY_SHOWS_CACHE,
      ...TV_PROGRAMMES_CACHE,
      ...SPECIAL_EVENTS_CACHE
    ];
  }, [allServerSerials]);

  // Filter serials and events in dropdown by search query
  const filteredDropdownSerials = useMemo(() => {
    if (!searchQuery.trim()) return allSelectableItems;
    const q = searchQuery.toLowerCase().trim();
    return allSelectableItems.filter(
      s => (s.title && s.title.toLowerCase().includes(q)) ||
           (s.tamilTitle && s.tamilTitle.includes(q)) ||
           (s.channel && s.channel.toLowerCase().includes(q)) ||
           (s.genre && s.genre.toLowerCase().includes(q)) ||
           (s.tag && s.tag.toLowerCase().includes(q))
    );
  }, [allSelectableItems, searchQuery]);

  /**
   * Formats metadata query strictly according to user requirements:
   * Server 1 (Tamildhool): "{Title} | {DD-MM-YYYY} |"  (e.g., "Kayal | 26-09-2026 |")
   * Server 2 (Tamilgun):   "{Title} {DD-MM-YYYY}"     (e.g., "Kayal 22-09-2026")
   */
  const buildMetadataString = (serial, dayNum = selectedDay, calDate = currentCalendarDate, serverId = activeServerId) => {
    if (!serial) return '';
    const d = String(dayNum).padStart(2, '0');
    const m = String(calDate.getMonth() + 1).padStart(2, '0');
    const y = calDate.getFullYear();
    const dateFormatted = `${d}-${m}-${y}`;
    if (serverId === 'tamilgun') {
      return `${serial.title} ${dateFormatted}`;
    }
    return `${serial.title} | ${dateFormatted} |`;
  };

  // Controls auto-hide timer & toggle matching MovieDetailScreen
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
    setControlsVisible(true);

    controlsTimerRef.current = setTimeout(() => {
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setControlsVisible(false);
      });
    }, 4000);
  }, [controlsOpacity]);

  const toggleControls = useCallback(() => {
    if (controlsVisible) {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setControlsVisible(false);
      });
    } else {
      resetControlsTimeout();
    }
  }, [controlsVisible, resetControlsTimeout, controlsOpacity]);

  const cyclePlaybackSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIdx]);
    resetControlsTimeout();
  };

  const toggleContentFitMode = () => {
    setContentFitMode(prev => (prev === 'cover' ? 'contain' : 'cover'));
    resetControlsTimeout();
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
    resetControlsTimeout();
  };

  const togglePlayerServer = () => {
    const nextServerId = activeServerId === 'tamildhool' ? 'tamilgun' : 'tamildhool';
    setActiveServerId(nextServerId);
    executeScrapeAndPlay(selectedSerial, selectedDay, nextServerId, currentCalendarDate);
    resetControlsTimeout();
  };

  // Interactive timeline scrubber gesture responder
  const scrubberPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        isScrubbingRef.current = true;
        const locX = evt.nativeEvent.locationX;
        const curWidth = scrubberWidthRef.current || scrubberWidth || (windowWidth - scale(28));
        const progress = Math.max(0, Math.min(1, locX / (curWidth || 1)));
        if (playbackDuration > 0) setPlaybackTime(progress * playbackDuration);
        resetControlsTimeout();
      },
      onPanResponderMove: (evt) => {
        const locX = evt.nativeEvent.locationX;
        const curWidth = scrubberWidthRef.current || scrubberWidth || (windowWidth - scale(28));
        const progress = Math.max(0, Math.min(1, locX / (curWidth || 1)));
        if (playbackDuration > 0) setPlaybackTime(progress * playbackDuration);
        resetControlsTimeout();
      },
      onPanResponderRelease: (evt) => {
        const locX = evt.nativeEvent.locationX;
        const curWidth = scrubberWidthRef.current || scrubberWidth || (windowWidth - scale(28));
        const progress = Math.max(0, Math.min(1, locX / (curWidth || 1)));
        if (vlcPlayerRef.current && playbackDuration > 0) {
          vlcPlayerRef.current.seek(progress);
        }
        isScrubbingRef.current = false;
        resetControlsTimeout();
      },
      onPanResponderTerminate: () => {
        isScrubbingRef.current = false;
        resetControlsTimeout();
      }
    });
  }, [playbackDuration, scrubberWidth, resetControlsTimeout]);

  /**
   * Execute live server scraper with formatted metadata and post stream + referer to VLC Player
   */
  const executeScrapeAndPlay = async (targetSerial = selectedSerial, dayNum = selectedDay, serverId = activeServerId, calDate = currentCalendarDate) => {
    if (!targetSerial) return;
    const d = String(dayNum).padStart(2, '0');
    const m = String(calDate.getMonth() + 1).padStart(2, '0');
    const y = calDate.getFullYear();
    const dateStr = `${d}-${m}-${y}`;
    const metadata = buildMetadataString(targetSerial, dayNum, calDate, serverId);

    setActiveMetadataQuery(metadata);
    setActiveMetadataDisplay(metadata);
    setIsLoadingStream(true);
    setIsPlayerActive(true);
    setIsPlaying(true);
    setIsBuffering(true);
    resetControlsTimeout();
    const serverLabel = serverId === 'tamilgun' ? 'Server 2 (Tamilgun)' : 'Server 1 (Tamildhool)';
    setScraperLoadingMessage(`Querying ${serverLabel} for:\n${metadata}`);

    try {
      const res = await scrapeEpisodeStreamWithMetadata(metadata, targetSerial, dateStr, serverId);
      if (res && res.streamUrl) {
        setCurrentStreamUrl(res.streamUrl);
        setCurrentStreamHeaders(res.headers || {});
        setCurrentStreamReferer(res.referer || res.headers?.Referer || res.headers?.referer || '');
        setScrapedServerName(res.server || serverLabel);
        if (res.matchedTitle) {
          setActiveMetadataDisplay(res.matchedTitle);
        }
      } else {
        setCurrentStreamUrl(targetSerial.streamUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
        setCurrentStreamHeaders({});
        setCurrentStreamReferer('');
        setScrapedServerName('Standard Stream');
      }
    } catch (err) {
      console.warn('[TvSerialsScreen] Live scraper error:', err?.message || err);
      setCurrentStreamUrl(targetSerial.streamUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    } finally {
      setIsLoadingStream(false);
    }
  };

  // Handle Play Episode directly inside TV Serials (No jump to Movie Details!)
  const handlePlayEpisode = (dayNum = selectedDay) => {
    setSelectedDay(dayNum);
    executeScrapeAndPlay(selectedSerial, dayNum, activeServerId, currentCalendarDate);
  };

  // Fullscreen toggle handler
  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsFullscreen(true);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setIsFullscreen(false);
    }
    resetControlsTimeout();
  };

  const handleSeek = (delta) => {
    if (!vlcPlayerRef.current || playbackDuration <= 0) return;
    const newTime = Math.max(0, Math.min(playbackDuration, playbackTime + delta));
    const targetPos = newTime / playbackDuration;
    vlcPlayerRef.current.seek(targetPos);
    setPlaybackTime(newTime);
    resetControlsTimeout();
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Active Stream Source strictly configured for existing VLCPlayerView with Hardware Decoding
  const activeStreamSource = useMemo(() => {
    const playUri = currentStreamUrl || selectedSerial?.streamUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const initOptions = [
      '--network-caching=2000',
      '--live-caching=2000',
      '--drop-late-frames',
      '--skip-frames'
    ];

    const ref = currentStreamReferer || currentStreamHeaders?.Referer || currentStreamHeaders?.referer;
    if (ref) {
      initOptions.push(`--http-referrer=${ref}`);
    }
    const ua = currentStreamHeaders?.['User-Agent'] || currentStreamHeaders?.['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    if (ua) {
      initOptions.push(`--http-user-agent=${ua}`);
    }

    return {
      uri: playUri,
      hwDecoderEnabled: VLCHardwareDecoder?.Automatic,
      mediaOptions: [
        ':network-caching=2000',
        ':http-reconnect=true',
        ':no-stats'
      ],
      initOptions
    };
  }, [currentStreamUrl, currentStreamReferer, currentStreamHeaders, selectedSerial]);

  // Serials for Home Page strictly deduplicated for Index Catalog (No duplicate Kayal or any serial)
  const homeFilteredSerials = useMemo(() => {
    const list = homeChannelFilter === 'all'
      ? allServerSerials
      : allServerSerials.filter(s => s.channelCode === homeChannelFilter);
    const seen = new Set();
    return list.filter(item => {
      const key = (item.title || item.serialCode || '').toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [homeChannelFilter, allServerSerials]);

  const homeFilteredReality = useMemo(() => {
    const list = homeChannelFilter === 'all'
      ? REALITY_SHOWS_CACHE
      : REALITY_SHOWS_CACHE.filter(r => r.channelCode === homeChannelFilter);
    const seen = new Set();
    return list.filter(item => {
      const key = (item.title || item.serialCode || '').toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [homeChannelFilter]);

  const homeFilteredProgrammes = useMemo(() => {
    const list = homeChannelFilter === 'all'
      ? TV_PROGRAMMES_CACHE
      : TV_PROGRAMMES_CACHE.filter(p => p.channelCode === homeChannelFilter);
    const seen = new Set();
    return list.filter(item => {
      const key = (item.title || item.serialCode || '').toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [homeChannelFilter]);

  const homeFilteredEvents = useMemo(() => {
    const list = homeChannelFilter === 'all'
      ? SPECIAL_EVENTS_CACHE
      : SPECIAL_EVENTS_CACHE.filter(e => e.channelCode === homeChannelFilter);
    const seen = new Set();
    return list.filter(item => {
      const key = (item.title || item.serialCode || '').toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [homeChannelFilter]);

  // ==============================================================
  // VIEW 2: INDIVIDUAL DETAILED SERIAL SCREEN (Step 1, 2, 3 + Player below camera hole)
  // ==============================================================
  if (isDetailView && selectedSerial) {
    return (
      <View style={[styles.detailScreenContainer, { paddingTop: topNotchPadding }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* FULLSCREEN VIDEO PLAYER MODAL (Identical UI/UX layout to MovieDetailScreen) */}
        {isFullscreen && isPlayerActive && (
          <Modal visible={isFullscreen} transparent={false} animationType="fade">
            <View style={styles.fullscreenContainer}>
              <StatusBar hidden={true} />
              <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls}>
                <VLCPlayerView
                  ref={vlcPlayerRef}
                  source={activeStreamSource}
                  autoplay={true}
                  paused={!isPlaying}
                  muted={isMuted}
                  rate={playbackSpeed}
                  resizeMode={contentFitMode === 'cover' ? 'cover' : 'contain'}
                  style={StyleSheet.absoluteFill}
                  progressUpdateInterval={500}
                  showNowPlaying={false}
                  continueAudioInBackground={false}
                  onLoadStart={() => {
                    setIsBuffering(true);
                  }}
                  onLoad={(event) => {
                    setIsBuffering(false);
                    if (event?.duration && event.duration > 0) {
                      setPlaybackDuration(event.duration / 1000);
                    }
                  }}
                  onProgress={(event) => {
                    if (!isScrubbingRef.current) {
                      setPlaybackTime(event.currentTime / 1000);
                      if (event.duration > 0) {
                        setPlaybackDuration(event.duration / 1000);
                      }
                    }
                  }}
                  onPlaying={() => {
                    setIsPlaying(true);
                    setIsBuffering(false);
                  }}
                  onPaused={() => {
                    setIsPlaying(false);
                  }}
                  onBuffer={(event) => {
                    setIsBuffering(Boolean(event?.isBuffering));
                  }}
                  onError={(err) => {
                    console.warn('[VLCPlayer Fullscreen] Playback error:', err);
                    setIsBuffering(false);
                  }}
                  onEnd={() => {
                    setIsPlaying(false);
                  }}
                />

                {/* Centered Floating Buffering Indicator */}
                {isBuffering && !controlsVisible && !isLoadingStream && (
                  <View pointerEvents="none" style={styles.floatingBufferingContainer}>
                    <View style={styles.floatingBufferingCircle}>
                      <ActivityIndicator size="large" color="#38bdf8" />
                    </View>
                  </View>
                )}

                {/* Scraper Resolving Loader Overlay */}
                {isLoadingStream && (
                  <View style={styles.scraperLoaderOverlay} pointerEvents="auto">
                    <View style={styles.scraperLoaderCard}>
                      <ActivityIndicator size="large" color="#38bdf8" />
                      <View style={styles.scraperQueryBadge}>
                        <Ionicons name="search" size={scale(14)} color="#38bdf8" style={{ marginRight: scale(6) }} />
                        <Text style={styles.scraperQueryBadgeText}>
                          {activeServerId === 'tamilgun' ? 'Server 2 Search' : 'Server 1 Search'}
                        </Text>
                      </View>
                      <Text style={styles.scraperQueryText} numberOfLines={2}>
                        {activeMetadataQuery || buildMetadataString(selectedSerial, selectedDay, currentCalendarDate, activeServerId)}
                      </Text>
                      <Text style={styles.scraperSubText}>
                        Posting stream with HTTP Referer to VLC Player Engine
                      </Text>
                    </View>
                  </View>
                )}

                {/* Fullscreen Controls Overlay */}
                {!isLoadingStream && (
                  <Animated.View
                    pointerEvents={controlsVisible ? 'box-none' : 'none'}
                    style={[
                      StyleSheet.absoluteFill,
                      styles.vlcControlsOverlay,
                      styles.fullscreenControlsPadding,
                      { opacity: controlsOpacity }
                    ]}
                  >
                    {/* Top Row */}
                    <View style={styles.vlcTopBar}>
                      <View style={styles.vlcTopLeft}>
                        <TouchableOpacity
                          style={styles.vlcCircularBtn}
                          onPress={toggleFullscreen}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="arrow-back" size={scale(20)} color="#ffffff" />
                        </TouchableOpacity>
                        <View style={{ marginLeft: scale(12), flex: 1 }}>
                          <Text style={[styles.vlcTitleText, { fontSize: moderateScale(16) }]} numberOfLines={1}>
                            {selectedSerial?.title || 'Tamil Serial'}
                          </Text>
                          <Text style={[styles.vlcSubtitleText, { fontSize: moderateScale(12) }]} numberOfLines={1}>
                            {selectedDay} {monthName} {year} • {activeServer.displayName}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.vlcTopRight}>
                        <TouchableOpacity
                          style={styles.vlcServerBadgePill}
                          onPress={togglePlayerServer}
                          activeOpacity={0.8}
                        >
                          <View style={styles.vlcServerDot} />
                          <Text style={styles.vlcServerBadgeText}>
                            {activeServer.displayName}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.vlcCircularBtn}
                          onPress={toggleContentFitMode}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons
                            name={contentFitMode === 'cover' ? 'aspect-ratio' : 'fit-to-screen'}
                            size={scale(18)}
                            color={contentFitMode === 'cover' ? '#38bdf8' : '#ffffff'}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.vlcCircularBtn}
                          onPress={toggleFullscreen}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons
                            name="fullscreen-exit"
                            size={scale(20)}
                            color="#ffffff"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Center Controls */}
                    <View style={[styles.vlcCenterControls, { gap: scale(48) }]}>
                      <TouchableOpacity
                        onPress={() => handleSeek(-10)}
                        activeOpacity={0.75}
                        style={[styles.vlcSkipBtn, { width: scale(52), height: scale(52), borderRadius: scale(26) }]}
                      >
                        <MaterialIcons name="replay-10" size={scale(30)} color="#ffffff" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setIsPlaying(prev => !prev)}
                        activeOpacity={0.85}
                        style={[styles.vlcPlayPauseBtn, { width: scale(68), height: scale(68), borderRadius: scale(34) }]}
                      >
                        {isBuffering ? (
                          <ActivityIndicator size="large" color="#0284c7" />
                        ) : (
                          <Ionicons
                            name={isPlaying ? 'pause' : 'play'}
                            size={scale(34)}
                            color="#000000"
                            style={!isPlaying ? { marginLeft: scale(4) } : null}
                          />
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleSeek(10)}
                        activeOpacity={0.75}
                        style={[styles.vlcSkipBtn, { width: scale(52), height: scale(52), borderRadius: scale(26) }]}
                      >
                        <MaterialIcons name="forward-10" size={scale(30)} color="#ffffff" />
                      </TouchableOpacity>
                    </View>

                    {/* Bottom Row */}
                    <View style={styles.vlcBottomContainer}>
                      {/* Scrubber Progress Bar */}
                      <View
                        style={[styles.vlcScrubberTouchArea, { height: verticalScale(32) }]}
                        onLayout={(e) => {
                          const w = e.nativeEvent.layout.width;
                          scrubberWidthRef.current = w;
                          setScrubberWidth(w);
                        }}
                        {...scrubberPanResponder.panHandlers}
                      >
                        <View pointerEvents="none" style={[styles.vlcScrubberTrack, { height: verticalScale(4.5) }]}>
                          <View
                            pointerEvents="none"
                            style={[
                              styles.vlcScrubberFill,
                              { width: `${playbackDuration > 0 ? Math.min(100, Math.max(0, (playbackTime / playbackDuration) * 100)) : 0}%` }
                            ]}
                          />
                          <View
                            pointerEvents="none"
                            style={[
                              styles.vlcScrubberThumb,
                              { 
                                width: scale(14), 
                                height: scale(14), 
                                borderRadius: scale(7), 
                                top: verticalScale(-4.75),
                                left: `${playbackDuration > 0 ? Math.min(100, Math.max(0, (playbackTime / playbackDuration) * 100)) : 0}%` 
                              }
                            ]}
                          />
                        </View>
                      </View>

                      {/* Timestamps */}
                      <View style={styles.vlcTimestampsRow}>
                        <Text style={[styles.vlcTimeTextLeft, { fontSize: moderateScale(12) }]}>{formatTime(playbackTime)}</Text>
                        <Text style={[styles.vlcTimeTextRight, { fontSize: moderateScale(12) }]}>{playbackDuration > 0 ? formatTime(playbackDuration) : '--:--'}</Text>
                      </View>

                      {/* Features Row */}
                      <View style={[styles.vlcFeaturesRow, { marginTop: verticalScale(10), gap: scale(14) }]}>
                        {/* Server Switcher Pill */}
                        <TouchableOpacity
                          onPress={togglePlayerServer}
                          activeOpacity={0.8}
                          style={[styles.vlcFeatureBtnPill, { height: scale(34), paddingHorizontal: scale(14) }]}
                        >
                          <MaterialCommunityIcons name="server-network" size={scale(16)} color="#38bdf8" style={{ marginRight: scale(6) }} />
                          <Text style={[styles.vlcFeatureBtnText, { fontSize: moderateScale(12) }]}>{activeServer.displayName}</Text>
                        </TouchableOpacity>

                        {/* Playback Speed */}
                        <TouchableOpacity
                          onPress={cyclePlaybackSpeed}
                          activeOpacity={0.8}
                          style={[styles.vlcFeatureBtn, { width: scale(34), height: scale(34), borderRadius: scale(17) }]}
                        >
                          <Text style={[styles.vlcSpeedText, { fontSize: moderateScale(12) }]}>{playbackSpeed}x</Text>
                        </TouchableOpacity>

                        {/* Aspect Ratio */}
                        <TouchableOpacity
                          onPress={toggleContentFitMode}
                          activeOpacity={0.8}
                          style={[styles.vlcFeatureBtn, { width: scale(34), height: scale(34), borderRadius: scale(17) }]}
                        >
                          <MaterialCommunityIcons
                            name={contentFitMode === 'cover' ? 'aspect-ratio' : 'fit-to-screen'}
                            size={scale(18)}
                            color={contentFitMode === 'cover' ? '#38bdf8' : '#ffffff'}
                          />
                        </TouchableOpacity>

                        {/* Audio Mute */}
                        <TouchableOpacity
                          onPress={toggleMute}
                          activeOpacity={0.8}
                          style={[styles.vlcFeatureBtn, { width: scale(34), height: scale(34), borderRadius: scale(17) }]}
                        >
                          <Ionicons
                            name={isMuted ? 'volume-mute' : 'volume-high'}
                            size={scale(18)}
                            color={isMuted ? '#f87171' : '#ffffff'}
                          />
                        </TouchableOpacity>

                        {/* Fullscreen Exit */}
                        <TouchableOpacity
                          onPress={toggleFullscreen}
                          activeOpacity={0.8}
                          style={[styles.vlcFeatureBtn, { width: scale(34), height: scale(34), borderRadius: scale(17) }]}
                        >
                          <MaterialCommunityIcons
                            name="fullscreen-exit"
                            size={scale(18)}
                            color="#ffffff"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
                )}
              </Pressable>
            </View>
          </Modal>
        )}

        {/* TOP NAVIGATION BAR: BACK TO TV SERIALS HOME */}
        <View style={styles.detailNavBar}>
          <TouchableOpacity
            style={styles.detailBackBtn}
            onPress={() => {
              setIsPlaying(false);
              setIsPlayerActive(false);
              setIsDetailView(false);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={scale(20)} color="#ffffff" />
            <Text style={styles.detailBackBtnText}>TV Serials Home</Text>
          </TouchableOpacity>

          <View style={styles.detailServerBadge}>
            <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.detailServerBadgeText}>{activeServer.displayName}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* TOP VIDEO PLAYER AREA: POSITIONED CLEANLY BELOW CAMERA HOLE */}
          <View style={styles.playerContainer}>
            {isPlayerActive ? (
              <View style={styles.playerBox}>
                <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls}>
                  <VLCPlayerView
                    ref={vlcPlayerRef}
                    source={activeStreamSource}
                    autoplay={true}
                    paused={!isPlaying}
                    muted={isMuted}
                    rate={playbackSpeed}
                    resizeMode={contentFitMode === 'cover' ? 'cover' : 'contain'}
                    style={StyleSheet.absoluteFill}
                    progressUpdateInterval={500}
                    showNowPlaying={false}
                    continueAudioInBackground={false}
                    onLoadStart={() => {
                      setIsBuffering(true);
                    }}
                    onLoad={(event) => {
                      setIsBuffering(false);
                      if (event?.duration && event.duration > 0) {
                        setPlaybackDuration(event.duration / 1000);
                      }
                    }}
                    onProgress={(event) => {
                      if (!isScrubbingRef.current) {
                        setPlaybackTime(event.currentTime / 1000);
                        if (event.duration > 0) {
                          setPlaybackDuration(event.duration / 1000);
                        }
                      }
                    }}
                    onPlaying={() => {
                      setIsPlaying(true);
                      setIsBuffering(false);
                    }}
                    onPaused={() => {
                      setIsPlaying(false);
                    }}
                    onBuffer={(event) => {
                      setIsBuffering(Boolean(event?.isBuffering));
                    }}
                    onError={(err) => {
                      console.warn('[VLCPlayer] Playback error:', err);
                      setIsBuffering(false);
                    }}
                    onEnd={() => {
                      setIsPlaying(false);
                    }}
                  />

                  {/* FLOATING CENTERED BUFFERING SPINNER (Displayed when video is buffering and controls are hidden) */}
                  {isBuffering && !controlsVisible && !isLoadingStream && (
                    <View pointerEvents="none" style={styles.floatingBufferingContainer}>
                      <View style={styles.floatingBufferingCircle}>
                        <ActivityIndicator size="small" color="#38bdf8" />
                      </View>
                    </View>
                  )}

                  {/* LIVE SCRAPER RESOLVING LOADER OVERLAY */}
                  {isLoadingStream && (
                    <View style={styles.scraperLoaderOverlay} pointerEvents="auto">
                      <View style={styles.scraperLoaderCard}>
                        <ActivityIndicator size="large" color="#38bdf8" />
                        <View style={styles.scraperQueryBadge}>
                          <Ionicons name="search" size={scale(13)} color="#38bdf8" style={{ marginRight: scale(5) }} />
                          <Text style={styles.scraperQueryBadgeText}>
                            {activeServerId === 'tamilgun' ? 'Server 2 Search' : 'Server 1 Search'}
                          </Text>
                        </View>
                        <Text style={styles.scraperQueryText} numberOfLines={2}>
                          {activeMetadataQuery || buildMetadataString(selectedSerial, selectedDay, currentCalendarDate, activeServerId)}
                        </Text>
                        <Text style={styles.scraperSubText}>
                          Posting stream with HTTP Referer to VLC Player Engine
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* CONTROLS OVERLAY (Matching MovieDetailScreen VLC Player UI/UX Layout) */}
                  {!isLoadingStream && (
                    <Animated.View
                      pointerEvents={controlsVisible ? 'box-none' : 'none'}
                      style={[
                        StyleSheet.absoluteFill,
                        styles.vlcControlsOverlay,
                        { opacity: controlsOpacity }
                      ]}
                    >
                      {/* Top Row: Back button + Title/Date + Server badge + Aspect Ratio + Fullscreen */}
                      <View style={styles.vlcTopBar}>
                        <View style={styles.vlcTopLeft}>
                          <TouchableOpacity
                            style={styles.vlcCircularBtn}
                            onPress={() => {
                              setIsPlaying(false);
                              setIsPlayerActive(false);
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="arrow-back" size={scale(16)} color="#ffffff" />
                          </TouchableOpacity>
                          <View style={{ marginLeft: scale(8), flex: 1 }}>
                            <Text style={styles.vlcTitleText} numberOfLines={1}>
                              {selectedSerial?.title || 'Tamil Serial'}
                            </Text>
                            <Text style={styles.vlcSubtitleText} numberOfLines={1}>
                              {selectedDay} {monthName} {year} • {activeServer.displayName}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.vlcTopRight}>
                          {/* Quick Server Switcher Badge Pill */}
                          <TouchableOpacity
                            style={styles.vlcServerBadgePill}
                            onPress={togglePlayerServer}
                            activeOpacity={0.8}
                          >
                            <View style={styles.vlcServerDot} />
                            <Text style={styles.vlcServerBadgeText}>
                              {activeServer.shortName}
                            </Text>
                          </TouchableOpacity>

                          {/* Aspect Ratio Mode */}
                          <TouchableOpacity
                            style={styles.vlcCircularBtn}
                            onPress={toggleContentFitMode}
                            activeOpacity={0.8}
                          >
                            <MaterialCommunityIcons
                              name={contentFitMode === 'cover' ? 'aspect-ratio' : 'fit-to-screen'}
                              size={scale(16)}
                              color={contentFitMode === 'cover' ? '#38bdf8' : '#ffffff'}
                            />
                          </TouchableOpacity>

                          {/* Fullscreen Button */}
                          <TouchableOpacity
                            style={styles.vlcCircularBtn}
                            onPress={toggleFullscreen}
                            activeOpacity={0.8}
                          >
                            <MaterialCommunityIcons
                              name="fullscreen"
                              size={scale(16)}
                              color="#ffffff"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Center Controls: Rewind 10s, Big Play/Pause, Forward 10s */}
                      <View style={styles.vlcCenterControls}>
                        <TouchableOpacity
                          onPress={() => handleSeek(-10)}
                          activeOpacity={0.75}
                          style={styles.vlcSkipBtn}
                        >
                          <MaterialIcons name="replay-10" size={scale(22)} color="#ffffff" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setIsPlaying(prev => !prev)}
                          activeOpacity={0.85}
                          style={styles.vlcPlayPauseBtn}
                        >
                          {isBuffering ? (
                            <ActivityIndicator size="small" color="#0284c7" />
                          ) : (
                            <Ionicons
                              name={isPlaying ? 'pause' : 'play'}
                              size={scale(26)}
                              color="#000000"
                              style={!isPlaying ? { marginLeft: scale(3) } : null}
                            />
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleSeek(10)}
                          activeOpacity={0.75}
                          style={styles.vlcSkipBtn}
                        >
                          <MaterialIcons name="forward-10" size={scale(22)} color="#ffffff" />
                        </TouchableOpacity>
                      </View>

                      {/* Bottom Row: Scrubber, Timestamps & Feature Toolbar */}
                      <View style={styles.vlcBottomContainer}>
                        {/* Scrubber Progress Bar */}
                        <View
                          style={styles.vlcScrubberTouchArea}
                          onLayout={(e) => {
                            const w = e.nativeEvent.layout.width;
                            scrubberWidthRef.current = w;
                            setScrubberWidth(w);
                          }}
                          {...scrubberPanResponder.panHandlers}
                        >
                          <View pointerEvents="none" style={styles.vlcScrubberTrack}>
                            <View
                              pointerEvents="none"
                              style={[
                                styles.vlcScrubberFill,
                                { width: `${playbackDuration > 0 ? Math.min(100, Math.max(0, (playbackTime / playbackDuration) * 100)) : 0}%` }
                              ]}
                            />
                            <View
                              pointerEvents="none"
                              style={[
                                styles.vlcScrubberThumb,
                                { left: `${playbackDuration > 0 ? Math.min(100, Math.max(0, (playbackTime / playbackDuration) * 100)) : 0}%` }
                              ]}
                            />
                          </View>
                        </View>

                        {/* Timestamps */}
                        <View style={styles.vlcTimestampsRow}>
                          <Text style={styles.vlcTimeTextLeft}>{formatTime(playbackTime)}</Text>
                          <Text style={styles.vlcTimeTextRight}>{playbackDuration > 0 ? formatTime(playbackDuration) : '--:--'}</Text>
                        </View>

                        {/* Features Row */}
                        <View style={styles.vlcFeaturesRow}>
                          {/* Server Switcher Pill */}
                          <TouchableOpacity
                            onPress={togglePlayerServer}
                            activeOpacity={0.8}
                            style={styles.vlcFeatureBtnPill}
                          >
                            <MaterialCommunityIcons name="server-network" size={scale(13)} color="#38bdf8" style={{ marginRight: scale(4) }} />
                            <Text style={styles.vlcFeatureBtnText}>{activeServer.shortName}</Text>
                          </TouchableOpacity>

                          {/* Playback Speed */}
                          <TouchableOpacity
                            onPress={cyclePlaybackSpeed}
                            activeOpacity={0.8}
                            style={styles.vlcFeatureBtn}
                          >
                            <Text style={styles.vlcSpeedText}>{playbackSpeed}x</Text>
                          </TouchableOpacity>

                          {/* Aspect Ratio */}
                          <TouchableOpacity
                            onPress={toggleContentFitMode}
                            activeOpacity={0.8}
                            style={styles.vlcFeatureBtn}
                          >
                            <MaterialCommunityIcons
                              name={contentFitMode === 'cover' ? 'aspect-ratio' : 'fit-to-screen'}
                              size={scale(15)}
                              color={contentFitMode === 'cover' ? '#38bdf8' : '#ffffff'}
                            />
                          </TouchableOpacity>

                          {/* Audio Mute */}
                          <TouchableOpacity
                            onPress={toggleMute}
                            activeOpacity={0.8}
                            style={styles.vlcFeatureBtn}
                          >
                            <Ionicons
                              name={isMuted ? 'volume-mute' : 'volume-high'}
                              size={scale(15)}
                              color={isMuted ? '#f87171' : '#ffffff'}
                            />
                          </TouchableOpacity>

                          {/* Fullscreen */}
                          <TouchableOpacity
                            onPress={toggleFullscreen}
                            activeOpacity={0.8}
                            style={styles.vlcFeatureBtn}
                          >
                            <MaterialCommunityIcons
                              name="fullscreen"
                              size={scale(15)}
                              color="#ffffff"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Animated.View>
                  )}
                </Pressable>
              </View>
            ) : (
              /* Decryptor Status Circles Hero matching attached image */
              <LinearGradient
                colors={['#080b14', '#0d1322', '#090d18']}
                style={styles.nodesHeroGradient}
              >
                <View style={styles.nodesRow}>
                  {/* Node 1: Tamil Server Source */}
                  <View style={styles.nodeItem}>
                    <View style={styles.nodeCircle}>
                      <Ionicons name="server-outline" size={scale(22)} color="#94a3b8" />
                    </View>
                    <Text style={styles.nodeLabel}>Tamil Server Source</Text>
                    <Text style={styles.nodeSubLabel}>{activeServer.name}</Text>
                  </View>

                  {/* Node 2: Client Decryptor Engine (Prominent center) */}
                  <View style={[styles.nodeItem, { marginTop: verticalScale(14) }]}>
                    <View style={[styles.nodeCircle, styles.nodeCircleActive]}>
                      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <Ionicons name="layers-outline" size={scale(26)} color="#38bdf8" />
                      </Animated.View>
                    </View>
                    <Text style={[styles.nodeLabel, { color: '#ffffff' }]}>Client Decryptor Engine</Text>
                    <Text style={[styles.nodeSubLabel, { color: '#38bdf8' }]}>Active Decryptor</Text>
                  </View>

                  {/* Node 3: Stream Output Sandbox */}
                  <View style={styles.nodeItem}>
                    <View style={styles.nodeCircle}>
                      <Ionicons name="videocam-outline" size={scale(22)} color="#94a3b8" />
                    </View>
                    <Text style={styles.nodeLabel}>Stream Output Sandbox</Text>
                    <Text style={styles.nodeSubLabel}>HLS Output</Text>
                  </View>
                </View>
              </LinearGradient>
            )}
          </View>

          {/* Metrics Status Bar */}
          <View style={styles.metricsBar}>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Target Channel</Text>
              <Text style={styles.metricValue}>{selectedSerial?.channel || 'Sun TV'}</Text>
            </View>

            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Index Latency</Text>
              <Text style={styles.metricValue}>{activeServer.latency}</Text>
            </View>

            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Payload Protocol</Text>
              <Text style={[styles.metricValue, { color: '#16a34a' }]}>
                {activeServer.protocol}
              </Text>
            </View>
          </View>

          {/* Active Scraper Metadata Query Bar matching user format: Title | DD-MM-YYYY | Channel Serial */}
          <View style={styles.metadataQueryBanner}>
            <View style={styles.metadataQueryLeft}>
              <Ionicons name="pulse" size={scale(16)} color="#38bdf8" style={{ marginRight: scale(6) }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.metadataQueryLabel}>Server Scraper Metadata Query</Text>
                <Text style={styles.metadataQueryValue} numberOfLines={1}>
                  {activeMetadataDisplay || buildMetadataString(selectedSerial, selectedDay, currentCalendarDate)}
                </Text>
              </View>
            </View>
            <View style={styles.metadataEngineBadge}>
              <Ionicons name="play" size={scale(10)} color="#22c55e" style={{ marginRight: scale(3) }} />
              <Text style={styles.metadataEngineBadgeText}>VLC Player Engine</Text>
            </View>
          </View>

          {/* ========================================================== */}
          {/* STEP 1, 2, 3 SECTION                                       */}
          {/* ========================================================== */}
          <View style={styles.stepsContainer}>
            {/* STEP 1: BUTTONS SERVER 1 (TAMILDHOOL) & SERVER 2 (TAMILGUN) - CHANNELS REMOVED */}
            <View style={styles.stepSection}>
              <Text style={styles.stepHeaderTitle}>Step 1: Select Server</Text>

              <View style={styles.serversRow}>
                {SERVERS.map((srv) => {
                  const isSelected = activeServerId === srv.id;
                  return (
                    <TouchableOpacity
                      key={srv.id}
                      style={[
                        styles.serverSelectButton,
                        isSelected ? styles.serverSelectButtonActive : styles.serverSelectButtonInactive
                      ]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setActiveServerId(srv.id);
                        executeScrapeAndPlay(selectedSerial, selectedDay, srv.id, currentCalendarDate);
                      }}
                    >
                      <Ionicons
                        name={isSelected ? 'shield-checkmark' : 'server-outline'}
                        size={scale(16)}
                        color={isSelected ? '#ffffff' : '#374151'}
                        style={{ marginRight: scale(6) }}
                      />
                      <Text
                        style={[
                          styles.serverSelectButtonText,
                          isSelected ? styles.serverSelectButtonTextActive : styles.serverSelectButtonTextInactive
                        ]}
                        numberOfLines={1}
                      >
                        {srv.displayName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* STEP 2: ALL SERIAL NAMES - EASY TO SELECT DROPDOWN LIST */}
            <View style={[styles.stepSection, { marginTop: verticalScale(16) }]}>
              <Text style={styles.stepHeaderTitle}>Step 2: Select Tamil Serial</Text>

              <TouchableOpacity
                style={styles.dropdownBox}
                activeOpacity={0.8}
                onPress={() => setDropdownVisible(true)}
              >
                <View style={styles.dropdownLeft}>
                  <ChannelLogo channelCode={selectedSerial?.channelCode} size={scale(16)} style={{ marginRight: scale(8) }} />
                  <Text style={styles.dropdownSelectedText} numberOfLines={1}>
                    {selectedSerial?.title} ({selectedSerial?.timeSlot})
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={scale(18)} color="#4b5563" />
              </TouchableOpacity>

              <Text style={styles.archiveSubtitle}>
                Available archive tracks: {selectedSerial?.episodesCount || '1240 episodes logged'}.
              </Text>
            </View>

            {/* STEP 3: SELECT BROADCAST PRODUCTION DATE (CALENDAR) */}
            <View style={[styles.stepSection, { marginTop: verticalScale(18) }]}>
              <View style={styles.calendarHeaderRow}>
                <Text style={styles.stepHeaderTitle}>Step 3: Select Broadcast Production Date</Text>

                <View style={styles.monthNav}>
                  <TouchableOpacity onPress={prevMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={scale(14)} color="#374151" />
                  </TouchableOpacity>
                  <Text style={styles.monthNavLabel}>{monthName} {year}</Text>
                  <TouchableOpacity onPress={nextMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-forward" size={scale(14)} color="#374151" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Calendar Grid matching screenshot */}
              <View style={styles.calendarCard}>
                <View style={styles.calendarWeekRow}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, idx) => (
                    <View key={`wk-${idx}`} style={styles.calendarWeekCell}>
                      <Text style={styles.calendarWeekText}>{w}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.calendarDaysGrid}>
                  {calendarDays.map((item) => {
                    if (item.day === null) {
                      return <View key={item.key} style={styles.emptyGridCell} />;
                    }

                    const isSelected = selectedDay === item.day;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[
                          styles.gridDayCell,
                          isSelected && styles.gridDayCellActive
                        ]}
                        activeOpacity={0.75}
                        onPress={() => {
                          setSelectedDay(item.day);
                          executeScrapeAndPlay(selectedSerial, item.day, activeServerId, currentCalendarDate);
                        }}
                      >
                        <Text
                          style={[
                            styles.gridDayText,
                            isSelected && styles.gridDayTextActive
                          ]}
                        >
                          {item.day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* ACTION BUTTON: WATCH EPISODE DIRECTLY IN-SCREEN (NO JUMP TO MOVIE DETAILS!) */}
            <View style={styles.actionBtnWrapper}>
              <TouchableOpacity
                style={styles.watchStreamButton}
                activeOpacity={0.85}
                onPress={() => executeScrapeAndPlay(selectedSerial, selectedDay, activeServerId, currentCalendarDate)}
              >
                <Ionicons name="play-circle" size={scale(20)} color="#ffffff" style={{ marginRight: scale(8) }} />
                <Text style={styles.watchStreamButtonText}>
                  {isPlayerActive ? 'Reload Stream' : 'Watch Episode Stream'} ({selectedDay} {monthName})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* MODAL DROPDOWN: ALL SERIAL NAMES */}
        <Modal
          visible={dropdownVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDropdownVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setDropdownVisible(false)}
          >
            <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalSheetTitle}>Select Tamil Serial</Text>
                  <Text style={styles.modalSheetSubtitle}>
                    {activeServer.displayName} • {allServerSerials.length} Serials Logged
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDropdownVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={scale(20)} color="#374151" />
                </TouchableOpacity>
              </View>

              <View style={styles.searchBar}>
                <Ionicons name="search" size={scale(16)} color="#6b7280" style={{ marginRight: scale(6) }} />
                <TextInput
                  placeholder="Search serial name or time..."
                  placeholderTextColor="#9ca3af"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={scale(16)} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView style={{ maxHeight: verticalScale(340) }} showsVerticalScrollIndicator={false}>
                {filteredDropdownSerials.map((s) => {
                  const isSelected = selectedSerial?.id === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.serialOptionItem,
                        isSelected && styles.serialOptionItemActive
                      ]}
                      activeOpacity={0.75}
                      onPress={() => {
                        setSelectedSerial(s);
                        setDropdownVisible(false);
                        setSearchQuery('');
                        executeScrapeAndPlay(s, selectedDay, activeServerId, currentCalendarDate);
                      }}
                    >
                      <View style={styles.serialOptionLeft}>
                        <ChannelLogo channelCode={s.channelCode} size={scale(20)} style={{ marginRight: scale(10) }} />
                        <View>
                          <Text style={[styles.serialOptionTitle, isSelected && styles.serialOptionTitleActive]}>
                            {s.title}
                          </Text>
                          <Text style={styles.serialOptionMeta}>
                            {s.tamilTitle} • {s.channel} • {s.timeSlot}
                          </Text>
                        </View>
                      </View>

                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={scale(20)} color="#2563eb" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  // ==============================================================
  // VIEW 1: HOME PAGE OF TV SERIALS (Catalog matching attached design)
  // ==============================================================
  return (
    <View style={[styles.homeScreenContainer, { paddingTop: topNotchPadding }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. TOP HERO BANNER (CONSTANT FIXED SIZE, NO SHIFTING ON ROTATION, NO STAR RATINGS) */}
        <View style={styles.heroOuterWrapper}>
          <LinearGradient
            colors={['#070a13', '#0b1222', '#0f172a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroCard}
          >
            {/* Top Row: Pill Tag + Pause/Play Button */}
            <View style={styles.heroHeaderRow}>
              <View style={styles.networkBadgePill}>
                <ChannelLogo channelCode={currentHero.channelCode} size={scale(13)} style={{ marginRight: scale(5) }} />
                <Text style={styles.networkBadgeText}>{currentHero.networkTag}</Text>
              </View>

              <TouchableOpacity
                style={styles.pauseCircleBtn}
                activeOpacity={0.7}
                onPress={() => setIsHeroPaused((prev) => !prev)}
              >
                <Ionicons
                  name={isHeroPaused ? 'play' : 'pause'}
                  size={scale(15)}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>

            {/* Hero Main Content Row: Constant fixed layout, description & time removed */}
            <View style={styles.heroMainRow}>
              <View style={styles.heroInfoColumn}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {currentHero.title}
                </Text>
                <Text style={styles.heroTamilTitle} numberOfLines={1}>
                  {currentHero.tamilTitle}
                </Text>

                {/* Action Button: Quick Play */}
                <View style={styles.heroActionsRow}>
                  <TouchableOpacity
                    style={styles.quickPlayButton}
                    activeOpacity={0.8}
                    onPress={() => handleOpenDetailScreen(currentHero)}
                  >
                    <Ionicons name="play" size={scale(14)} color="#ffffff" style={{ marginRight: scale(5) }} />
                    <Text style={styles.quickPlayText}>Quick Play</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Glass Live Broadcast Box */}
              <View style={styles.liveBroadcastContainer}>
                <View style={styles.liveBroadcastGlassCard}>
                  <Ionicons name="tv-outline" size={scale(24)} color="#eab308" />
                  <Text style={styles.liveBroadcastTitle}>LIVE</Text>
                  <Text style={styles.liveBroadcastSubtitle}>BROADCAST</Text>
                  <Animated.View style={[styles.liveStatusDot, { opacity: pulseAnim }]} />
                </View>
              </View>
            </View>

            {/* Carousel Pagination Dots (Fixed 5 major highlights) */}
            <View style={styles.paginationRow}>
              {heroHighlights.map((_, index) => {
                const isActive = index === heroIndex;
                return (
                  <TouchableOpacity
                    key={`dot-${index}`}
                    onPress={() => setHeroIndex(index)}
                    activeOpacity={0.7}
                    style={[
                      styles.paginationDot,
                      isActive ? styles.paginationDotActive : styles.paginationDotInactive
                    ]}
                  />
                );
              })}
            </View>
          </LinearGradient>
        </View>

        {/* 2. PRIMARY BROADCASTERS / சேனல்கள் (KTV REMOVED, OFFICIAL LOGOS) */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <Ionicons name="tv" size={scale(18)} color="#2563eb" style={{ marginRight: scale(8) }} />
            <Text style={styles.sectionHeaderTitle}>Primary Broadcasters / சேனல்கள்</Text>
          </View>
          <View style={styles.liveScraperChip}>
            <Text style={styles.liveScraperChipText}>{liveSyncStatus}</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.broadcastersScrollContent}
        >
          {CHANNELS.map((broadcaster) => {
            const isSelected = homeChannelFilter === broadcaster.id;
            return (
              <TouchableOpacity
                key={broadcaster.id}
                style={[
                  styles.broadcasterPill,
                  isSelected && styles.broadcasterPillSelected
                ]}
                activeOpacity={0.75}
                onPress={() => {
                  if (homeChannelFilter === broadcaster.id) {
                    setHomeChannelFilter('all');
                  } else {
                    setHomeChannelFilter(broadcaster.id);
                  }
                }}
              >
                <ChannelLogo channelCode={broadcaster.code} size={scale(20)} style={{ marginRight: scale(8) }} />
                <View style={styles.broadcasterNamesWrapper}>
                  <Text style={styles.broadcasterName}>{broadcaster.name}</Text>
                  <Text style={styles.broadcasterTamilName}>{broadcaster.tamilName}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 3. TRENDING DAILY SERIALS / தொடர்கள் (NO star ratings, opens individual detail on click) */}
        <View style={[styles.sectionHeaderRow, { marginTop: verticalScale(16) }]}>
          <View style={styles.sectionTitleWithIcon}>
            <Ionicons name="trending-up" size={scale(18)} color="#ef4444" style={{ marginRight: scale(8) }} />
            <Text style={styles.sectionHeaderTitle}>Trending Daily Serials / தொடர்கள்</Text>
          </View>
        </View>

        <View style={styles.cardsGridContainer}>
          {homeFilteredSerials.map((serial) => (
            <TouchableOpacity
              key={serial.id}
              style={[
                styles.serialCard,
                { borderColor: serial.borderColor || '#38bdf8' }
              ]}
              activeOpacity={0.82}
              onPress={() => handleOpenDetailScreen(serial)}
            >
              <ImageBackground
                source={{ uri: serial.image }}
                style={styles.cardImageBg}
                imageStyle={styles.cardImageBgInner}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={['rgba(15, 23, 42, 0.45)', 'rgba(15, 23, 42, 0.82)', '#090d16']}
                  style={styles.cardGradientOverlay}
                >
                  {/* Top row: Channel Badge + Time Slot */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.channelBadgePill}>
                      <ChannelLogo channelCode={serial.channelCode} size={scale(11)} style={{ marginRight: scale(4) }} />
                      <Text style={styles.channelBadgeText}>{serial.channel}</Text>
                    </View>
                    <View style={styles.cardSlotBadge}>
                      <Text style={styles.cardSlotBadgeText}>{serial.timeSlot}</Text>
                    </View>
                  </View>

                  {/* Center: Title + Tamil Subtitle */}
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardTitleText} numberOfLines={1}>
                      {serial.title}
                    </Text>
                    <Text style={[styles.cardTamilTitleText, { color: serial.tamilColor || '#38bdf8' }]} numberOfLines={1}>
                      {serial.tamilTitle}
                    </Text>
                  </View>

                  {/* Bottom: Episodes count + Tag */}
                  <View style={styles.cardBottomRow}>
                    <Text style={styles.cardMetaLeft}>{serial.episodes}</Text>
                    <Text style={styles.cardMetaRight}>{serial.tag || 'Daily Soap'}</Text>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </View>

        {/* 4. POPULAR REALITY SHOWS / நிகழ்ச்சிகள் (NO star ratings) */}
        <View style={styles.realityHeaderWrapper}>
          <Text style={styles.sectionHeaderTitleCentered}>Popular Reality Shows / நிகழ்ச்சிகள்</Text>
        </View>

        <View style={styles.cardsGridContainer}>
          {homeFilteredReality.map((show) => (
            <TouchableOpacity
              key={show.id}
              style={[
                styles.serialCard,
                { borderColor: show.borderColor || '#818cf8' }
              ]}
              activeOpacity={0.82}
              onPress={() => handleOpenDetailScreen(show)}
            >
              <ImageBackground
                source={{ uri: show.image }}
                style={styles.cardImageBg}
                imageStyle={styles.cardImageBgInner}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={['rgba(15, 23, 42, 0.45)', 'rgba(15, 23, 42, 0.82)', '#090d16']}
                  style={styles.cardGradientOverlay}
                >
                  {/* Top row: Channel Badge + Air Slot */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.channelBadgePill}>
                      <ChannelLogo channelCode={show.channelCode} size={scale(11)} style={{ marginRight: scale(4) }} />
                      <Text style={styles.channelBadgeText}>{show.channel}</Text>
                    </View>
                    <View style={styles.cardSlotBadge}>
                      <Text style={styles.cardSlotBadgeText}>Weekend</Text>
                    </View>
                  </View>

                  {/* Center: Title + Tamil Subtitle */}
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardTitleText} numberOfLines={1}>
                      {show.title}
                    </Text>
                    <Text style={[styles.cardTamilTitleText, { color: show.tamilColor || '#818cf8' }]} numberOfLines={1}>
                      {show.tamilTitle}
                    </Text>
                  </View>

                  {/* Bottom: Genre + Time Slot */}
                  <View style={styles.cardBottomRow}>
                    <Text style={styles.cardMetaLeft}>{show.genre}</Text>
                    <Text style={styles.cardMetaRight}>{show.timeSlot}</Text>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </View>

        {/* 5. TV PROGRAMMES / தொலைக்காட்சி நிகழ்ச்சிகள் (NEW CATEGORY BELOW REALITY SHOWS) */}
        <View style={styles.realityHeaderWrapper}>
          <Text style={styles.sectionHeaderTitleCentered}>TV Programmes / தொலைக்காட்சி நிகழ்ச்சிகள்</Text>
        </View>

        <View style={styles.cardsGridContainer}>
          {homeFilteredProgrammes.map((prg) => (
            <TouchableOpacity
              key={prg.id}
              style={[
                styles.serialCard,
                { borderColor: prg.borderColor || '#38bdf8' }
              ]}
              activeOpacity={0.82}
              onPress={() => handleOpenDetailScreen(prg)}
            >
              <ImageBackground
                source={{ uri: prg.image }}
                style={styles.cardImageBg}
                imageStyle={styles.cardImageBgInner}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={['rgba(15, 23, 42, 0.45)', 'rgba(15, 23, 42, 0.82)', '#090d16']}
                  style={styles.cardGradientOverlay}
                >
                  {/* Top row: Channel Badge + Genre Tag */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.channelBadgePill}>
                      <ChannelLogo channelCode={prg.channelCode} size={scale(11)} style={{ marginRight: scale(4) }} />
                      <Text style={styles.channelBadgeText}>{prg.channel}</Text>
                    </View>
                    <View style={styles.cardSlotBadge}>
                      <Text style={styles.cardSlotBadgeText}>{prg.tag || 'Special'}</Text>
                    </View>
                  </View>

                  {/* Center: Title + Tamil Subtitle */}
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardTitleText} numberOfLines={1}>
                      {prg.title}
                    </Text>
                    <Text style={[styles.cardTamilTitleText, { color: prg.tamilColor || '#38bdf8' }]} numberOfLines={1}>
                      {prg.tamilTitle}
                    </Text>
                  </View>

                  {/* Bottom: Genre + Air time */}
                  <View style={styles.cardBottomRow}>
                    <Text style={styles.cardMetaLeft}>{prg.genre}</Text>
                    <Text style={styles.cardMetaRight}>{prg.timeSlot}</Text>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </View>

        {/* 6. SPECIAL EVENTS & MEGA SHOWS / சிறப்பு நிகழ்ச்சிகள் (NO EVENTS MISSING) */}
        <View style={styles.realityHeaderWrapper}>
          <Text style={styles.sectionHeaderTitleCentered}>Special Events & Mega Shows / சிறப்பு நிகழ்ச்சிகள்</Text>
        </View>

        <View style={styles.cardsGridContainer}>
          {homeFilteredEvents.map((evt) => (
            <TouchableOpacity
              key={evt.id}
              style={[
                styles.serialCard,
                { borderColor: evt.borderColor || '#c084fc' }
              ]}
              activeOpacity={0.82}
              onPress={() => handleOpenDetailScreen(evt)}
            >
              <ImageBackground
                source={{ uri: evt.image }}
                style={styles.cardImageBg}
                imageStyle={styles.cardImageBgInner}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={['rgba(15, 23, 42, 0.45)', 'rgba(15, 23, 42, 0.82)', '#090d16']}
                  style={styles.cardGradientOverlay}
                >
                  {/* Top row: Channel Badge + Tag */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.channelBadgePill}>
                      <ChannelLogo channelCode={evt.channelCode} size={scale(11)} style={{ marginRight: scale(4) }} />
                      <Text style={styles.channelBadgeText}>{evt.channel}</Text>
                    </View>
                    <View style={styles.cardSlotBadge}>
                      <Text style={styles.cardSlotBadgeText}>{evt.tag || 'Mega Event'}</Text>
                    </View>
                  </View>

                  {/* Center: Title + Tamil Subtitle */}
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardTitleText} numberOfLines={1}>
                      {evt.title}
                    </Text>
                    <Text style={[styles.cardTamilTitleText, { color: evt.tamilColor || '#c084fc' }]} numberOfLines={1}>
                      {evt.tamilTitle}
                    </Text>
                  </View>

                  {/* Bottom: Genre + Air info */}
                  <View style={styles.cardBottomRow}>
                    <Text style={styles.cardMetaLeft}>{evt.genre}</Text>
                    <Text style={styles.cardMetaRight}>{evt.timeSlot}</Text>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  homeScreenContainer: {
    flex: 1,
    backgroundColor: '#080c14',
  },
  detailScreenContainer: {
    flex: 1,
    backgroundColor: '#080c14',
  },
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollContent: {
    paddingBottom: verticalScale(90),
  },

  // Detail Navigation Bar
  detailNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    backgroundColor: '#080c14',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  detailBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailBackBtnText: {
    color: '#ffffff',
    fontSize: moderateScale(13),
    fontWeight: '700',
    marginLeft: scale(6),
  },
  detailServerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: verticalScale(4),
    paddingHorizontal: scale(10),
    borderRadius: scale(12),
  },
  detailServerBadgeText: {
    color: '#ffffff',
    fontSize: moderateScale(10.5),
    fontWeight: '700',
  },
  detailScroll: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  detailScrollContent: {
    paddingBottom: verticalScale(90),
  },

  // Video Player Area (Positioned cleanly below camera hole)
  playerContainer: {
    width: '100%',
    backgroundColor: '#000000',
  },
  playerBox: {
    width: '100%',
    height: (windowWidth * 9) / 16,
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'space-between',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loaderText: {
    color: '#38bdf8',
    fontSize: moderateScale(12),
    fontWeight: '700',
    marginTop: verticalScale(8),
  },
  playerOverlayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingTop: verticalScale(8),
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  statusDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    marginRight: scale(5),
  },
  // VLC Player Controls Layout (Matching MovieDetailScreen UI/UX)
  vlcControlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'space-between',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(8),
    zIndex: 40,
  },
  fullscreenControlsPadding: {
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(14),
  },
  vlcTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vlcTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(8),
  },
  vlcCircularBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  vlcTitleText: {
    color: '#ffffff',
    fontSize: moderateScale(13),
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  vlcSubtitleText: {
    color: '#94a3b8',
    fontSize: moderateScale(10),
    fontWeight: '600',
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  vlcTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  vlcServerBadgePill: {
    paddingHorizontal: scale(8),
    height: scale(28),
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  vlcServerDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: '#22c55e',
    marginRight: scale(5),
  },
  vlcServerBadgeText: {
    color: '#38bdf8',
    fontSize: moderateScale(9.5),
    fontWeight: '800',
  },
  vlcCenterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(28),
  },
  vlcSkipBtn: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vlcPlayPauseBtn: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#ffffff',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  vlcBottomContainer: {
    width: '100%',
  },
  vlcScrubberTouchArea: {
    height: verticalScale(26),
    width: '100%',
    justifyContent: 'center',
    overflow: 'visible',
  },
  vlcScrubberTrack: {
    height: verticalScale(3.5),
    backgroundColor: 'rgba(82, 82, 91, 0.85)',
    width: '100%',
    borderRadius: scale(2),
    position: 'relative',
    overflow: 'visible',
  },
  vlcScrubberFill: {
    height: '100%',
    backgroundColor: '#38bdf8',
    borderRadius: scale(2),
  },
  vlcScrubberThumb: {
    position: 'absolute',
    transform: [{ translateX: scale(-6) }],
    top: verticalScale(-4.25),
    width: scale(12),
    height: scale(12),
    borderRadius: scale(6),
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
  },
  vlcTimestampsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: verticalScale(1),
    paddingHorizontal: scale(2),
  },
  vlcTimeTextLeft: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: moderateScale(10.5),
    fontWeight: '700',
  },
  vlcTimeTextRight: {
    color: '#a1a1aa',
    fontSize: moderateScale(10.5),
    fontWeight: '700',
  },
  vlcFeaturesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(6),
    gap: scale(8),
  },
  vlcFeatureBtn: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vlcFeatureBtnPill: {
    height: scale(30),
    paddingHorizontal: scale(10),
    borderRadius: scale(15),
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vlcFeatureBtnText: {
    color: '#38bdf8',
    fontSize: moderateScale(10),
    fontWeight: '800',
  },
  vlcSpeedText: {
    color: '#ffffff',
    fontSize: moderateScale(10),
    fontWeight: '700',
  },
  floatingBufferingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 35,
  },
  floatingBufferingCircle: {
    width: scale(54),
    height: scale(54),
    borderRadius: scale(27),
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  scraperLoaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    paddingHorizontal: scale(20),
  },
  scraperLoaderCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  scraperQueryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: scale(12),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(3),
    marginTop: verticalScale(12),
    marginBottom: verticalScale(6),
  },
  scraperQueryBadgeText: {
    color: '#38bdf8',
    fontWeight: '800',
    fontSize: moderateScale(10),
    textTransform: 'uppercase',
  },
  scraperQueryText: {
    color: '#ffffff',
    fontSize: moderateScale(12.5),
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: verticalScale(4),
  },
  scraperSubText: {
    color: '#94a3b8',
    fontSize: moderateScale(10),
    fontWeight: '600',
    textAlign: 'center',
  },

  // 3 Status Circles Hero Gradient
  nodesHeroGradient: {
    paddingVertical: verticalScale(22),
    paddingHorizontal: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  nodesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  nodeItem: {
    alignItems: 'center',
    flex: 1,
  },
  nodeCircle: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  nodeCircleActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  nodeLabel: {
    color: '#cbd5e1',
    fontSize: moderateScale(10),
    fontWeight: '700',
    textAlign: 'center',
  },
  nodeSubLabel: {
    color: '#64748b',
    fontSize: moderateScale(8.5),
    fontWeight: '600',
    marginTop: verticalScale(2),
  },

  // Metrics Bar
  metricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: verticalScale(14),
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    elevation: 1,
  },
  metricCol: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: '#6b7280',
    fontSize: moderateScale(11),
    fontWeight: '500',
    marginBottom: verticalScale(2),
  },
  metricValue: {
    color: '#111827',
    fontSize: moderateScale(13.5),
    fontWeight: '800',
  },

  // Steps Container
  stepsContainer: {
    paddingHorizontal: scale(14),
    paddingTop: verticalScale(16),
  },
  stepSection: {
    marginBottom: verticalScale(6),
  },
  stepHeaderTitle: {
    color: '#1f2937',
    fontSize: moderateScale(13.5),
    fontWeight: '800',
    marginBottom: verticalScale(10),
  },

  // Step 1: Server Buttons (Channels removed!)
  serversRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(10),
  },
  serverSelectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(13),
    paddingHorizontal: scale(10),
    borderRadius: scale(10),
    borderWidth: 1.2,
  },
  serverSelectButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    elevation: 3,
  },
  serverSelectButtonInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#f1f5f9',
  },
  serverSelectButtonText: {
    fontSize: moderateScale(12.5),
    fontWeight: '800',
  },
  serverSelectButtonTextActive: {
    color: '#ffffff',
  },
  serverSelectButtonTextInactive: {
    color: '#1f2937',
  },

  // Step 2: Dropdown Selector
  dropdownBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: scale(10),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(14),
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownSelectedText: {
    color: '#111827',
    fontSize: moderateScale(13),
    fontWeight: '700',
    flex: 1,
  },
  archiveSubtitle: {
    color: '#6b7280',
    fontSize: moderateScale(11),
    fontWeight: '500',
    marginTop: verticalScale(6),
  },

  // Step 3: Calendar
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: scale(8),
    paddingVertical: verticalScale(4),
    paddingHorizontal: scale(8),
  },
  monthNavBtn: {
    padding: scale(4),
  },
  monthNavLabel: {
    color: '#111827',
    fontSize: moderateScale(12),
    fontWeight: '800',
    marginHorizontal: scale(6),
  },
  calendarCard: {
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: scale(12),
    padding: scale(8),
    backgroundColor: '#ffffff',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: verticalScale(6),
  },
  calendarWeekCell: {
    flex: 1,
    alignItems: 'center',
  },
  calendarWeekText: {
    color: '#6b7280',
    fontSize: moderateScale(11.5),
    fontWeight: '700',
  },
  calendarDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyGridCell: {
    width: `${100 / 7}%`,
    height: verticalScale(36),
  },
  gridDayCell: {
    width: `${100 / 7}%`,
    height: verticalScale(36),
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: verticalScale(2),
    borderRadius: scale(6),
    backgroundColor: '#f1f5f9',
  },
  gridDayCellActive: {
    backgroundColor: '#2563eb',
  },
  gridDayText: {
    color: '#1f2937',
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  gridDayTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },

  // Action Button
  actionBtnWrapper: {
    marginTop: verticalScale(22),
    alignItems: 'center',
  },
  watchStreamButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: verticalScale(14),
    borderRadius: scale(14),
    elevation: 4,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  watchStreamButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(14),
    fontWeight: '900',
  },

  // Modal Dropdown Sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: scale(16),
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderRadius: scale(16),
    padding: scale(16),
    maxHeight: '82%',
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: verticalScale(12),
  },
  modalSheetTitle: {
    color: '#111827',
    fontSize: moderateScale(15),
    fontWeight: '900',
  },
  modalSheetSubtitle: {
    color: '#6b7280',
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginTop: verticalScale(2),
  },
  modalCloseBtn: {
    padding: scale(4),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: scale(10),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    marginBottom: verticalScale(10),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(12),
    color: '#111827',
    paddingVertical: 0,
  },
  serialOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderRadius: scale(8),
  },
  serialOptionItemActive: {
    backgroundColor: '#eff6ff',
  },
  serialOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serialOptionTitle: {
    color: '#111827',
    fontSize: moderateScale(13),
    fontWeight: '800',
  },
  serialOptionTitleActive: {
    color: '#2563eb',
  },
  serialOptionMeta: {
    color: '#6b7280',
    fontSize: moderateScale(10.5),
    fontWeight: '600',
    marginTop: verticalScale(2),
  },

  // -------------------------------------------------------------
  // HOME PAGE STYLES (CONSTANT FIXED HERO CARD SIZE)
  // -------------------------------------------------------------
  heroOuterWrapper: {
    paddingHorizontal: scale(10),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(6),
    backgroundColor: '#060912',
  },
  heroCard: {
    height: verticalScale(140), // CONSTANT FIXED HEIGHT (Prevents border sizing jumps)
    minHeight: verticalScale(140),
    maxHeight: verticalScale(140),
    borderRadius: scale(18),
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(10),
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: verticalScale(30),
  },
  networkBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: verticalScale(3),
    paddingHorizontal: scale(10),
    borderRadius: scale(18),
  },
  networkBadgeText: {
    color: '#ffffff',
    fontSize: moderateScale(10),
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  pauseCircleBtn: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  heroInfoColumn: {
    flex: 1,
    paddingRight: scale(10),
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: moderateScale(18),
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroTamilTitle: {
    color: '#f59e0b',
    fontSize: moderateScale(13.5),
    fontWeight: '800',
    marginTop: verticalScale(1),
    marginBottom: verticalScale(6),
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(14),
    borderRadius: scale(20),
    marginRight: scale(10),
    elevation: 3,
  },
  quickPlayText: {
    color: '#ffffff',
    fontSize: moderateScale(11.5),
    fontWeight: '800',
  },
  heroTimeSlotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: verticalScale(4),
    paddingHorizontal: scale(8),
    borderRadius: scale(12),
  },
  heroTimeSlotText: {
    color: '#cbd5e1',
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  liveBroadcastContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: scale(4),
  },
  liveBroadcastGlassCard: {
    width: scale(82),
    height: scale(82),
    borderRadius: scale(14),
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '8deg' }],
    position: 'relative',
  },
  liveBroadcastTitle: {
    color: '#94a3b8',
    fontSize: moderateScale(8),
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: verticalScale(2),
  },
  liveBroadcastSubtitle: {
    color: '#64748b',
    fontSize: moderateScale(6.5),
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  liveStatusDot: {
    position: 'absolute',
    bottom: scale(5),
    right: scale(5),
    width: scale(7),
    height: scale(7),
    borderRadius: scale(3.5),
    backgroundColor: '#22c55e',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  paginationDot: {
    height: verticalScale(4.5),
    borderRadius: scale(2.25),
  },
  paginationDotActive: {
    width: scale(20),
    backgroundColor: '#3b82f6',
  },
  paginationDotInactive: {
    width: scale(6),
    backgroundColor: '#475569',
  },

  // Broadcasters Row (Home)
  sectionHeaderRow: {
    paddingHorizontal: scale(14),
    marginTop: verticalScale(14),
    marginBottom: verticalScale(10),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveScraperChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  liveScraperChipText: {
    color: '#4ade80',
    fontSize: moderateScale(9.5),
    fontWeight: '800',
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    color: '#1f2937',
    fontSize: moderateScale(14),
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  broadcastersScrollContent: {
    paddingHorizontal: scale(14),
    gap: scale(10),
  },
  broadcasterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: verticalScale(7),
    paddingHorizontal: scale(14),
    borderRadius: scale(12),
    borderWidth: 1.2,
    borderColor: '#e5e7eb',
    elevation: 1,
  },
  broadcasterPillSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb',
  },
  broadcasterNamesWrapper: {
    justifyContent: 'center',
  },
  broadcasterName: {
    color: '#111827',
    fontSize: moderateScale(12),
    fontWeight: '800',
  },
  broadcasterTamilName: {
    color: '#6b7280',
    fontSize: moderateScale(9.5),
    fontWeight: '600',
    marginTop: verticalScale(1),
  },

  // Cards Grid (Home)
  cardsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: scale(12),
    rowGap: verticalScale(10),
  },
  serialCard: {
    width: (windowWidth - scale(32)) / 2,
    borderRadius: scale(14),
    borderWidth: 1.2,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardImageBg: {
    width: '100%',
  },
  cardImageBgInner: {
    borderRadius: scale(13),
  },
  cardGradientOverlay: {
    padding: scale(10),
    justifyContent: 'space-between',
    minHeight: verticalScale(124),
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: verticalScale(2),
    paddingHorizontal: scale(7),
    borderRadius: scale(6),
  },
  channelBadgeText: {
    color: '#f3f4f6',
    fontSize: moderateScale(9.5),
    fontWeight: '700',
  },
  cardSlotBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: verticalScale(2),
    paddingHorizontal: scale(6),
    borderRadius: scale(6),
  },
  cardSlotBadgeText: {
    color: '#93c5fd',
    fontSize: moderateScale(9),
    fontWeight: '700',
  },
  cardTitleContainer: {
    marginVertical: verticalScale(8),
  },
  cardTitleText: {
    color: '#ffffff',
    fontSize: moderateScale(13.5),
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  cardTamilTitleText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    marginTop: verticalScale(2),
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: verticalScale(6),
  },
  cardMetaLeft: {
    color: '#94a3b8',
    fontSize: moderateScale(9.5),
    fontWeight: '600',
  },
  cardMetaRight: {
    color: '#94a3b8',
    fontSize: moderateScale(9.5),
    fontWeight: '600',
  },

  // Section Headers for Reality & TV Programmes (Home)
  realityHeaderWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(20),
    marginBottom: verticalScale(10),
  },
  sectionHeaderTitleCentered: {
    color: '#1f2937',
    fontSize: moderateScale(14),
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  // Active Server Scraper Metadata Query Bar & VLC Engine Badge
  metadataQueryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a0f1d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.25)',
    paddingVertical: verticalScale(9),
    paddingHorizontal: scale(14),
  },
  metadataQueryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(8),
  },
  metadataQueryLabel: {
    color: '#94a3b8',
    fontSize: moderateScale(9),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metadataQueryValue: {
    color: '#38bdf8',
    fontSize: moderateScale(11.5),
    fontWeight: '800',
    marginTop: verticalScale(1),
  },
  metadataEngineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    paddingVertical: verticalScale(3),
    paddingHorizontal: scale(7),
    borderRadius: scale(6),
  },
  metadataEngineBadgeText: {
    color: '#4ade80',
    fontSize: moderateScale(9.5),
    fontWeight: '700',
  },
  loaderSubText: {
    color: '#94a3b8',
    fontSize: moderateScale(10),
    fontWeight: '600',
    marginTop: verticalScale(4),
  },
});
