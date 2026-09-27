import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from '../utils/responsive';

export default function BottomTabBar({ activeTab = 'Home', onTabPress }) {
  const tabs = [
    { name: 'Home', iconActive: 'home', iconInactive: 'home-outline', label: 'Home' },
    { name: 'Movies', iconActive: 'film', iconInactive: 'film-outline', label: 'Movies' },
    { name: 'TV Series', iconActive: 'tv', iconInactive: 'tv-outline', label: 'TV Series' },
    { name: 'TV Serials', iconActive: 'albums', iconInactive: 'albums-outline', label: 'TV Serials' },
    { name: 'Search', iconActive: 'search', iconInactive: 'search-outline', label: 'Search' },
    { name: 'Account', iconActive: 'person', iconInactive: 'person-outline', label: 'Account' },
  ];

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.glassContainer}>
        {/* Glass reflection top highlight */}
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.15)',
            'rgba(255, 255, 255, 0.04)',
            'rgba(10, 10, 15, 0.45)'
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={styles.tabBarPill}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.name;
            const iconName = isActive ? tab.iconActive : tab.iconInactive;
            const tintColor = isActive ? '#38bdf8' : '#a1a1aa';

            return (
              <TouchableOpacity
                key={tab.name}
                style={[
                  styles.tabButton,
                  isActive && styles.tabButtonActive
                ]}
                activeOpacity={0.6}
                delayPressIn={0}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                onPress={() => onTabPress && onTabPress(tab.name)}
              >
                <Ionicons
                  name={iconName}
                  size={scale(18)}
                  color={tintColor}
                />
                <Text 
                  numberOfLines={1}
                  style={[
                    styles.tabLabel, 
                    { color: tintColor, fontWeight: isActive ? '700' : '500' }
                  ]}
                >
                  {tab.label}
                </Text>
                {isActive && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: verticalScale(14),
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(12),
    zIndex: 999,
  },
  glassContainer: {
    width: '100%',
    borderRadius: scale(38),
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 18, 24, 0.65)', // Pure semi-transparent frosted glass
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderTopColor: 'rgba(255, 255, 255, 0.32)',
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.65,
    shadowRadius: 20,
    elevation: 25,
  },
  tabBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: verticalScale(5),
    paddingHorizontal: scale(6),
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(5),
    paddingHorizontal: scale(2),
    borderRadius: scale(20),
  },
  tabButtonActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
  },
  tabLabel: {
    fontSize: moderateScale(8.5),
    marginTop: verticalScale(2),
    letterSpacing: 0,
    textAlign: 'center',
  },
  activeDot: {
    width: scale(3.5),
    height: scale(3.5),
    borderRadius: scale(2),
    backgroundColor: '#38bdf8',
    marginTop: verticalScale(2),
  }
});
