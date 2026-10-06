const fs = require('fs');
const path = 'C:\\Users\\Ajo\\Desktop\\Android Projects\\Stitch-nexplay\\App.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add isTvSerialsDetailOpen state
if (!content.includes('isTvSerialsDetailOpen')) {
  content = content.replace(
    'const [navigationStack, setNavigationStack] = useState([]);',
    'const [navigationStack, setNavigationStack] = useState([]);\n  const [isTvSerialsDetailOpen, setIsTvSerialsDetailOpen] = useState(false);'
  );
}

// 2. Update tabs and add topAccountBtn
const targetTabs = `            {/* 3. TV SERIES TAB */}
            {activeTab === 'TV Series' && (
              <TvSeriesScreen 
                onMoviePress={handleMoviePress} 
                onSeeMore={handleSeeMore}
              />
            )}

            {/* 4. TV SERIALS TAB */}
            {activeTab === 'TV Serials' && (
              <TvSerialsScreen 
                onMoviePress={handleMoviePress} 
                onSeeMore={handleSeeMore}
              />
            )}

            {/* 4. SEARCH TAB */}
            {activeTab === 'Search' && (
              <SearchScreen onMoviePress={handleMoviePress} />
            )}

            {/* 5. ACCOUNT TAB */}
            {activeTab === 'Account' && (
              <AccountScreen onPlayOffline={handlePlayOffline} />
            )}`;

const replacementTabs = `            {/* 3. SERIES TAB */}
            {(activeTab === 'Series' || activeTab === 'TV Series') && (
              <TvSeriesScreen 
                onMoviePress={handleMoviePress} 
                onSeeMore={handleSeeMore}
              />
            )}

            {/* 4. LIVE TV & SERIALS TAB */}
            {(activeTab === 'Live TV & Serials' || activeTab === 'TV Serials') && (
              <TvSerialsScreen 
                onMoviePress={handleMoviePress} 
                onSeeMore={handleSeeMore}
                onDetailStateChange={setIsTvSerialsDetailOpen}
              />
            )}

            {/* 4. SEARCH TAB */}
            {activeTab === 'Search' && (
              <SearchScreen onMoviePress={handleMoviePress} />
            )}

            {/* 5. ACCOUNT TAB */}
            {activeTab === 'Account' && (
              <AccountScreen onPlayOffline={handlePlayOffline} />
            )}

            {/* Top-Right Account Profile Button */}
            {!isTvSerialsDetailOpen && (
              <TouchableOpacity
                style={[
                  styles.topAccountBtn,
                  activeTab === 'Account' && styles.topAccountBtnActive
                ]}
                activeOpacity={0.8}
                onPress={() => activeTab === 'Account' ? handleTabPress('Home') : handleTabPress('Account')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name={activeTab === 'Account' ? 'person' : 'person-outline'}
                  size={scale(17)}
                  color={activeTab === 'Account' ? '#38bdf8' : '#ffffff'}
                />
              </TouchableOpacity>
            )}`;

if (content.includes(targetTabs)) {
  content = content.replace(targetTabs, replacementTabs);
  console.log('Replaced tabs in App.js');
} else {
  console.warn('targetTabs not matched in App.js');
}

// 3. Add styles
if (!content.includes('topAccountBtn:')) {
  const targetStyle = `  accountBadgeText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  }
});`;

  const replacementStyle = `  accountBadgeText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  topAccountBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : verticalScale(34)) : verticalScale(44),
    right: scale(16),
    zIndex: 998,
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  topAccountBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
    borderColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.5,
  }
});`;

  if (content.includes(targetStyle)) {
    content = content.replace(targetStyle, replacementStyle);
    console.log('Added topAccountBtn style to App.js');
  } else {
    console.warn('targetStyle not matched in App.js');
  }
}

fs.writeFileSync(path, content, 'utf8');
console.log('App.js successfully saved!');
