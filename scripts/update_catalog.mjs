import fs from 'fs';
import {
  COMPREHENSIVE_ALL_SERIALS,
  COMPREHENSIVE_ALL_REALITY,
  COMPREHENSIVE_ALL_PROGRAMMES
} from '../src/utils/TvSerialsLiveScraper.js';

const allowedSerialCodes = new Set([
  // Sun TV (16)
  'kayal', 'singapennae', 'vanathai_pola', 'marumagal', 'moondru_mudichu', 'annam', 'lakshmi', 'thulasi',
  'sundari', 'sevvanthi', 'ilakkiya', 'iniya', 'mr_manaivi', 'malar', 'poonkodi', 'priyamaana_thozhi',
  // Vijay TV (16)
  'siragadikka_aasai', 'baakiyalakshmi', 'pandian_stores_2', 'mahanathi', 'aaha_kalyanam', 'modhalum_kaadhalum',
  'malli', 'chinna_marumagal', 'thendrale_mella_pesu', 'ayyanar_thunai', 'azhagae_azhagu', 'thaai_maaman',
  'sakthivel', 'ponni', 'thangamagal', 'nee_naan_kaadhal',
  // Zee Tamil (15)
  'karthigai_deepam', 'sandhya_raagam', 'ayali', 'thirumangalyam', 'samanthi', 'vaagai_sooda_vaa',
  'vasudha', 'parijatham', 'salangai_oli', 'puthu_vasantham', 'idhayam', 'varisu', 'veera', 'meenakshi_ponnunga', 'anna'
]);

const allowedRealityCodes = new Set([
  'bigg_boss_10', 'super_singer', 'cooku_with_comali', 'start_music', 'top_cooku', 'super_samayal',
  'saregamapa', 'dance_jodi_dance', 'super_mom', 'junior_super_stars', 'mr_mrs_chinnathirai', 'super_singer_junior'
]);

const allowedProgCodes = new Set([
  'neeya_naana', 'tamizha_tamizha', 'vanakkam_tamizha', 'sunday_kondattam', 'cine_mini', 'natchathira_kondattam', 'olimayamana_ethirkalam'
]);

const serials = COMPREHENSIVE_ALL_SERIALS.filter(s => allowedSerialCodes.has(s.serialCode));
const reality = COMPREHENSIVE_ALL_REALITY.filter(r => allowedRealityCodes.has(r.serialCode)).map(r => {
  if (r.serialCode === 'bigg_boss_10') {
    return { ...r, tag: 'Prime Show', networkTag: 'VIJAY TV • PRIME SHOW' };
  }
  return r;
});
const programmes = COMPREHENSIVE_ALL_PROGRAMMES.filter(p => allowedProgCodes.has(p.serialCode));

const fileContent = `/**
 * TvSerialsLiveScraper.js
 * High-performance Scraper & Resolver for Tamil TV Serials
 * Supports:
 * - Server 1 (tamildhool.tech)
 * - Server 2 (arivumani.net / playallu.xyz)
 */

import axios from 'axios';

// Available Tamil Serials with Real Poster Images
export const COMPREHENSIVE_ALL_SERIALS = ${JSON.stringify(serials, null, 2)};

// Available Reality Shows with Posters
export const COMPREHENSIVE_ALL_REALITY = ${JSON.stringify(reality, null, 2)};

// Available TV Programmes with Posters
export const COMPREHENSIVE_ALL_PROGRAMMES = ${JSON.stringify(programmes, null, 2)};

// Special Events (Empty - omitted from home screen index per requirements)
export const COMPREHENSIVE_ALL_EVENTS = [];

/**
 * Scrape episode stream from active server using metadata query
 * Format Server 1: "Kayal | 26-09-2026 |"
 * Format Server 2: "Kayal 22-09-2026"
 */
export async function scrapeEpisodeStreamWithMetadata(metadataQuery, serialObj, dateStr, serverId = 'tamildhool') {
  let title = serialObj?.title || 'Kayal';
  let queryDate = dateStr || '26-09-2026';
  let channel = (serialObj?.channel || 'Sun TV').replace(/Serial|Show|Programme/gi, '').trim();

  if (metadataQuery) {
    if (metadataQuery.includes('|')) {
      const parts = metadataQuery.split('|').map(s => s.trim()).filter(Boolean);
      if (parts[0]) title = parts[0];
      if (parts[1]) queryDate = parts[1];
      if (parts[2]) channel = parts[2].replace(/Serial|Show|Programme/gi, '').trim();
    } else {
      const dateMatch = metadataQuery.match(/\\b\\d{2}-\\d{2}-\\d{4}\\b/);
      if (dateMatch) {
        queryDate = dateMatch[0];
        title = metadataQuery.replace(dateMatch[0], '').replace(/\\|/g, '').trim();
      } else {
        title = metadataQuery.replace(/\\|/g, '').trim();
      }
    }
  }

  const { TamilDhool } = await import('../providers/tamildhool/TamilDhoolProvider.js');
  const { TamilGun, REQUIRED_PLAYALLU_HEADERS } = await import('../providers/tamilgun/TamilGunProvider.js');

  // 1. If Server 2 (TamilGun / Arivumani)
  if (serverId === 'tamilgun') {
    try {
      const res = await TamilGun.findEpisodeByDate(title, queryDate, channel);
      if (res && res.streamUrl) {
        return {
          streamUrl: res.streamUrl,
          headers: res.headers || REQUIRED_PLAYALLU_HEADERS,
          referer: res.headers?.Referer || 'https://play.playallu.xyz/',
          matchedTitle: res.matchedTitle || \`\${title} \${queryDate}\`,
          server: 'Server 2',
          status: 'success'
        };
      }
    } catch (e) {
      console.warn('[TvSerialsLiveScraper] Server 2 error:', e.message);
    }
  }

  // 2. If Server 1 (Tamildhool)
  try {
    const res = await TamilDhool.findEpisodeByDate(title, queryDate, channel);
    const resolvedUrl = res?.streamUrl || res?.bestStream?.url || res?.details?.links?.[0]?.url;
    if (res && resolvedUrl) {
      return {
        streamUrl: resolvedUrl,
        headers: res.headers || { Referer: 'https://tamildhool.tech/' },
        referer: res.headers?.Referer || res.headers?.referer || 'https://tamildhool.tech/',
        matchedTitle: res.matchedTitle || res.title || res.post?.title || \`\${title} | \${queryDate} |\`,
        server: 'Server 1',
        status: 'success'
      };
    }
  } catch (e) {
    console.warn('[TvSerialsLiveScraper] Server 1 error:', e.message);
  }

  // 3. Fallback to Server 2 if Server 1 had no stream
  if (serverId !== 'tamilgun') {
    try {
      const res = await TamilGun.findEpisodeByDate(title, queryDate, channel);
      if (res && res.streamUrl) {
        return {
          streamUrl: res.streamUrl,
          headers: res.headers || REQUIRED_PLAYALLU_HEADERS,
          referer: res.headers?.Referer || 'https://play.playallu.xyz/',
          matchedTitle: res.matchedTitle || \`\${title} \${queryDate}\`,
          server: 'Server 2',
          status: 'success'
        };
      }
    } catch (e) {}
  }

  // 4. No sandbox HLS link! Return null so player displays clean playback error
  return {
    streamUrl: null,
    headers: null,
    referer: null,
    matchedTitle: serverId === 'tamilgun' ? \`\${title} \${queryDate}\` : \`\${title} | \${queryDate} |\`,
    server: serverId === 'tamilgun' ? 'Server 2' : 'Server 1',
    status: 'error'
  };
}
`;

fs.writeFileSync('src/utils/TvSerialsLiveScraper.js', fileContent, 'utf8');
console.log('TvSerialsLiveScraper.js updated successfully!');
