import type { User, Room } from "@shared/schema";

function makeSampleUser(
  id: string, firstName: string, lastName: string, portrait: string,
  opts?: { ring?: string; flair?: string; decoration?: string; bio?: string; offline?: boolean }
): User {
  return {
    id,
    email: null,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    profileImageUrl: `https://randomuser.me/api/portraits/${portrait}.jpg`,
    bio: opts?.bio || null,
    avatarRing: opts?.ring || null,
    flairBadge: opts?.flair || null,
    profileDecoration: opts?.decoration || null,
    instagramUrl: null,
    linkedinUrl: null,
    facebookUrl: null,
    status: opts?.offline ? "offline" : "online",
    role: "user",
    warningCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export const SAMPLE_USERS = {
  sofia:    makeSampleUser("sample-user-1",  "Sofia",    "Martinez", "women/32",  { bio: "Passionate about bridging cultures through language" }),
  liam:     makeSampleUser("sample-user-2",  "Liam",     "Chen",     "men/46",    { bio: "Daily English practice enthusiast & tech lover" }),
  emma:     makeSampleUser("sample-user-3",  "Emma",     "Davis",    "women/28",  { bio: "Loves French cinema and casual Spanish conversation", offline: true }),
  carlos:   makeSampleUser("sample-user-4",  "Carlos",   "Rivera",   "men/14",    { bio: "Native speaker helping beginners get confident" }),
  aigerim:  makeSampleUser("sample-user-5",  "Aigerim",  "Bekova",   "women/61",  { bio: "Trilingual and always looking for a language buddy" }),
  marcus:   makeSampleUser("sample-user-6",  "Marcus",   "Williams", "men/88",    { bio: "Advanced English, advanced mindset, let's talk!" }),
  anya:     makeSampleUser("sample-user-7",  "Anya",     "Petrova",  "women/52",  { bio: "Russian soul, English dreams, talking daily", offline: true }),
  james:    makeSampleUser("sample-user-8",  "James",    "O'Brien",  "men/67",    { bio: "Join my room for casual conversation practice" }),
  nadia:    makeSampleUser("sample-user-9",  "Nadia",    "Hassan",   "women/77",  { bio: "Arabic & English fluent — DM me anytime", offline: true }),
  kevin:    makeSampleUser("sample-user-10", "Kevin",    "Park",     "men/33",    { bio: "K-pop fan, Korean learner, English speaker" }),
  yuki:     makeSampleUser("sample-user-11", "Yuki",     "Tanaka",   "women/5",   { bio: "Anime lover learning English through stories" }),
  min:      makeSampleUser("sample-user-12", "Min",      "Ji-hoon",  "men/72",    { bio: "Korean music producer, language enthusiast" }),
  seo:      makeSampleUser("sample-user-13", "Seo",      "Yeon",     "women/44",  { bio: "Sharing Korean culture one conversation at a time" }),
  pierre:   makeSampleUser("sample-user-14", "Pierre",   "Dupont",   "men/55",    { bio: "Parisian language coach and coffee enthusiast" }),
  claire:   makeSampleUser("sample-user-15", "Claire",   "Bernard",  "women/17",  { bio: "French literature lover, English practice daily" }),
  hassan:   makeSampleUser("sample-user-16", "Hassan",   "Al-Amin",  "men/78",    { bio: "Teaching Arabic, learning Spanish step by step" }),
  fatima:   makeSampleUser("sample-user-17", "Fatima",   "Zahra",    "women/90",  { bio: "Language is the map to every culture" }),
  takeshi:  makeSampleUser("sample-user-18", "Takeshi",  "Mori",     "men/36",    { bio: "Kendo practitioner and Japanese calligraphy artist" }),
  hana:     makeSampleUser("sample-user-19", "Hana",     "Suzuki",   "women/26",  { bio: "Beginner English speaker, fluent in smiles" }),
  lucas:    makeSampleUser("sample-user-20", "Lucas",    "Santos",   "men/22",    { bio: "Brazilian rhythm, global mindset, let's talk!" }),
  priya:    makeSampleUser("sample-user-21", "Priya",    "Sharma",   "women/13",  { bio: "Software engineer practicing English and French" }),
  ivan:     makeSampleUser("sample-user-22", "Ivan",     "Petrov",   "men/19",    { bio: "Chess player and language lover from Moscow" }),
  mei:      makeSampleUser("sample-user-23", "Mei",      "Lin",      "women/47",  { bio: "Sharing Mandarin culture one chat at a time" }),
  diego:    makeSampleUser("sample-user-24", "Diego",    "Torres",   "men/25",    { bio: "Mexican cooking teacher turned language coach" }),
  amara:    makeSampleUser("sample-user-25", "Amara",    "Osei",     "women/65",  { bio: "Ghanaian storyteller, English and French fluent", offline: true }),
  bjorn:    makeSampleUser("sample-user-26", "Bjorn",    "Andersen", "men/71",    { bio: "Scandinavian minimalist, maximalist in language" }),
  isabela:  makeSampleUser("sample-user-27", "Isabela",  "Costa",    "women/38",  { bio: "Rio native exploring Japanese and Korean" }),
  kwame:    makeSampleUser("sample-user-28", "Kwame",    "Asante",   "men/85",    { bio: "Entrepreneur learning Mandarin for business" }),
  natasha:  makeSampleUser("sample-user-29", "Natasha",  "Volkov",   "women/57",  { bio: "Ballet dancer turned English teacher", offline: true }),
  ryo:      makeSampleUser("sample-user-30", "Ryo",      "Nakamura", "men/8",     { bio: "Game developer learning Spanish and Arabic" }),
};

export const SAMPLE_ROOMS: Room[] = [
  { id: "sample-room-1", title: "English Club 🇬🇧",          language: "English",  level: "Beginner",     maxUsers: 3, ownerId: SAMPLE_USERS.sofia.id,   isPublic: false, activeUsers: 3, roomTheme: "neon",     hologramVideoUrl: null, createdAt: new Date() },
  { id: "sample-room-2", title: "Spanish Practice 🇪🇸",      language: "Spanish",  level: "Intermediate", maxUsers: 4, ownerId: SAMPLE_USERS.carlos.id,  isPublic: true,  activeUsers: 2, roomTheme: "sunset",   hologramVideoUrl: null, createdAt: new Date() },
  { id: "sample-room-3", title: "Advanced English Talk",      language: "English",  level: "Advanced",     maxUsers: 5, ownerId: SAMPLE_USERS.marcus.id,  isPublic: true,  activeUsers: 5, roomTheme: "ocean",    hologramVideoUrl: null, createdAt: new Date() },
  { id: "sample-room-4", title: "Korean Study Group 🇰🇷",    language: "Korean",   level: "Beginner",     maxUsers: 3, ownerId: SAMPLE_USERS.min.id,     isPublic: true,  activeUsers: 3, roomTheme: "galaxy",   hologramVideoUrl: null, createdAt: new Date() },
  { id: "sample-room-5", title: "French Conversation 🇫🇷",   language: "French",   level: "Intermediate", maxUsers: 3, ownerId: SAMPLE_USERS.pierre.id,  isPublic: false, activeUsers: 3, roomTheme: "violet",   hologramVideoUrl: null, createdAt: new Date() },
  { id: "sample-room-6", title: "Japanese Practice 🇯🇵",     language: "Japanese", level: "Beginner",     maxUsers: 4, ownerId: SAMPLE_USERS.yuki.id,    isPublic: false, activeUsers: 4, roomTheme: "cherry",   hologramVideoUrl: null, createdAt: new Date() },
  { id: "sample-room-7", title: "Arabic Circle 🇸🇦",         language: "Arabic",   level: "Beginner",     maxUsers: 3, ownerId: SAMPLE_USERS.hassan.id,  isPublic: true,  activeUsers: 3, roomTheme: "neon",     hologramVideoUrl: null, createdAt: new Date() },
  { id: "sample-room-8", title: "German Stammtisch 🇩🇪",     language: "German",   level: "Intermediate", maxUsers: 3, ownerId: SAMPLE_USERS.bjorn.id,   isPublic: true,  activeUsers: 2, roomTheme: "storm",    hologramVideoUrl: null, createdAt: new Date() },
  { id: "sample-room-9", title: "Hindi for Beginners 🇮🇳",   language: "Hindi",    level: "Beginner",     maxUsers: 4, ownerId: SAMPLE_USERS.priya.id,   isPublic: true,  activeUsers: 3, roomTheme: "sunset",   hologramVideoUrl: null, createdAt: new Date() },
];

export const BASE_SAMPLE_PARTICIPANTS: Record<string, User[]> = {
  "sample-room-1": [SAMPLE_USERS.sofia, SAMPLE_USERS.liam, SAMPLE_USERS.emma],
  "sample-room-2": [SAMPLE_USERS.carlos, SAMPLE_USERS.aigerim],
  "sample-room-3": [SAMPLE_USERS.marcus, SAMPLE_USERS.anya, SAMPLE_USERS.james, SAMPLE_USERS.nadia, SAMPLE_USERS.kevin],
  "sample-room-4": [SAMPLE_USERS.min, SAMPLE_USERS.seo, SAMPLE_USERS.hassan],
  "sample-room-5": [SAMPLE_USERS.pierre, SAMPLE_USERS.claire, SAMPLE_USERS.fatima],
  "sample-room-6": [SAMPLE_USERS.yuki, SAMPLE_USERS.takeshi, SAMPLE_USERS.hana, SAMPLE_USERS.lucas],
  "sample-room-7": [SAMPLE_USERS.hassan, SAMPLE_USERS.fatima, SAMPLE_USERS.amara],
  "sample-room-8": [SAMPLE_USERS.bjorn, SAMPLE_USERS.ivan],
  "sample-room-9": [SAMPLE_USERS.priya, SAMPLE_USERS.diego, SAMPLE_USERS.kwame],
};

export const BASE_SAMPLE_VOTE_COUNTS: Record<string, number> = {
  "sample-room-1": 12, "sample-room-2": 7,  "sample-room-3": 24,
  "sample-room-4": 18, "sample-room-5": 9,  "sample-room-6": 15,
  "sample-room-7": 11, "sample-room-8": 6,  "sample-room-9": 14,
};

export const SAMPLE_FOLLOWER_COUNTS: Record<string, number> = {
  "sample-user-1":  145, "sample-user-2":  89,  "sample-user-3":  203,
  "sample-user-4":  67,  "sample-user-5":  312, "sample-user-6":  421,
  "sample-user-7":  156, "sample-user-8":  78,  "sample-user-9":  234,
  "sample-user-10": 91,  "sample-user-11": 189, "sample-user-12": 342,
  "sample-user-13": 127, "sample-user-14": 56,  "sample-user-15": 98,
  "sample-user-16": 213, "sample-user-17": 176, "sample-user-18": 144,
  "sample-user-19": 267, "sample-user-20": 83,  "sample-user-21": 158,
  "sample-user-22": 72,  "sample-user-23": 241, "sample-user-24": 119,
  "sample-user-25": 305, "sample-user-26": 88,  "sample-user-27": 196,
  "sample-user-28": 143, "sample-user-29": 221, "sample-user-30": 67,
};

export const SAMPLE_SPEAKER_META: Record<string, { bio: string; languages: string[]; voteCount: number; commentCount: number; isOnline: boolean }> = {
  "sample-user-1":  { bio: "Passionate about bridging cultures through language", languages: ["English", "Spanish"],  voteCount: 89,  commentCount: 24, isOnline: true  },
  "sample-user-2":  { bio: "Daily English practice enthusiast & tech lover",      languages: ["English", "Mandarin"], voteCount: 54,  commentCount: 11, isOnline: true  },
  "sample-user-3":  { bio: "Loves French cinema and casual Spanish conversation",  languages: ["French", "Spanish"],   voteCount: 112, commentCount: 31, isOnline: false },
  "sample-user-4":  { bio: "Native speaker helping beginners get confident",       languages: ["Spanish", "English"],  voteCount: 43,  commentCount: 9,  isOnline: true  },
  "sample-user-5":  { bio: "Trilingual and always looking for a language buddy",   languages: ["Korean", "French"],    voteCount: 201, commentCount: 56, isOnline: true  },
  "sample-user-6":  { bio: "Advanced English, advanced mindset, let's talk!",      languages: ["English", "German"],   voteCount: 267, commentCount: 74, isOnline: true  },
  "sample-user-7":  { bio: "Russian soul, English dreams, talking daily",          languages: ["English", "Russian"],  voteCount: 95,  commentCount: 28, isOnline: false },
  "sample-user-8":  { bio: "Join my room for casual conversation practice",        languages: ["English", "Irish"],    voteCount: 48,  commentCount: 15, isOnline: true  },
  "sample-user-9":  { bio: "Arabic & English fluent — DM me anytime",             languages: ["English", "Arabic"],   voteCount: 143, commentCount: 41, isOnline: false },
  "sample-user-10": { bio: "K-pop fan, Korean learner, English speaker",           languages: ["Korean", "English"],   voteCount: 58,  commentCount: 19, isOnline: true  },
  "sample-user-21": { bio: "Software engineer practicing English and French",      languages: ["English", "French"],   voteCount: 76,  commentCount: 22, isOnline: true  },
  "sample-user-22": { bio: "Chess player and language lover from Moscow",          languages: ["Russian", "English"],  voteCount: 38,  commentCount: 8,  isOnline: false },
  "sample-user-23": { bio: "Sharing Mandarin culture one chat at a time",          languages: ["Chinese", "English"],  voteCount: 134, commentCount: 37, isOnline: true  },
  "sample-user-24": { bio: "Mexican cooking teacher turned language coach",        languages: ["Spanish", "English"],  voteCount: 67,  commentCount: 18, isOnline: true  },
  "sample-user-25": { bio: "Ghanaian storyteller, English and French fluent",      languages: ["English", "French"],   voteCount: 189, commentCount: 45, isOnline: false },
  "sample-user-26": { bio: "Scandinavian minimalist, maximalist in language",      languages: ["German", "English"],   voteCount: 51,  commentCount: 13, isOnline: true  },
  "sample-user-27": { bio: "Rio native exploring Japanese and Korean",             languages: ["Portuguese", "Japanese"], voteCount: 103, commentCount: 29, isOnline: true  },
  "sample-user-28": { bio: "Entrepreneur learning Mandarin for business",          languages: ["English", "Chinese"],  voteCount: 82,  commentCount: 21, isOnline: true  },
  "sample-user-29": { bio: "Ballet dancer turned English teacher",                 languages: ["Russian", "English"],  voteCount: 127, commentCount: 33, isOnline: false },
  "sample-user-30": { bio: "Game developer learning Spanish and Arabic",           languages: ["Japanese", "Spanish"], voteCount: 44,  commentCount: 12, isOnline: true  },
};

export const ALL_SAMPLE_USERS = Object.values(SAMPLE_USERS);
export const SAMPLE_PEOPLE = ALL_SAMPLE_USERS.slice(0, 20);
