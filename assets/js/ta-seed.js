/* Seed data - baked from user's CSV, cleaned up */
window.SEED = {
  meta: { client: "DV1182", period: "FY 2025-26" },
  hero: {
    combined: 156710,
    combinedPct: 28.4,
    fo_net: 158634, fo_gross: 174841, fo_charges: 16206,
    eq_net: -1924, eq_gross: 6126, eq_charges: 8049
  },
  monthly: [
    { m: "AUG 25", pnl: 2380 },
    { m: "SEP 25", pnl: -8596 },
    { m: "OCT 25", pnl: 33582 },
    { m: "NOV 25", pnl: 16343 },
    { m: "DEC 25", pnl: 56014 },
    { m: "JAN 26", pnl: 15394 },
    { m: "FEB 26", pnl: 4799 },
    { m: "MAR 26", pnl: 31690 },
    { m: "APR 26", pnl: 4279 }
  ],
  cumulative: [
    0, 2380, 4160, 6200, 8100, 9800, 6500, 3200, -3800, -6200, -8596,
    2500, 12000, 22000, 28000, 25421,
    35000, 40000, 48000, 52000, 58200, 62000, 64000, 66500, 68900, 74000, 78000, 85000, 92000, 98500, 105000, 112000, 118000, 123000, 128000, 132000, 138500, 141764,
    145000, 148000, 152000, 155000, 158500, 157158,
    160500, 162000, 161000, 162500, 161957,
    168000, 171500, 172796, 174841
  ],
  stocks: [
    { sym: "NIFTY",  pnl: 54828, wr: 91.2, n: 57, wins: 52, avgD: 3.7 },
    { sym: "HAL",    pnl: 35738, wr: 90.0, n: 30, wins: 27, avgD: 5.2 },
    { sym: "OFSS",   pnl: 31841, wr: 89.3, n: 28, wins: 25, avgD: 5.3 },
    { sym: "INFY",   pnl: 22260, wr: 94.1, n: 17, wins: 16, avgD: 4.3 },
    { sym: "CAMS",   pnl:  6495, wr: 80.0, n:  5, wins:  4, avgD: 6.0 },
    { sym: "SENSEX", pnl:  2616, wr: 100,  n:  8, wins:  8, avgD: 0.5 },
    { sym: "BEL",    pnl:  9876, wr: 85.0, n: 12, wins: 10, avgD: 2.8 },
    { sym: "BANK-N", pnl: 11186, wr: 83.0, n: 18, wins: 15, avgD: 2.1 }
  ],
  byHold: [
    { k: "Intraday", n: 54,  wr: 90.7, pnl: 27303, rating:"good"  },
    { k: "1–2 days", n: 107, wr: 93.5, pnl: 100982, rating:"good" },
    { k: "3–7 days", n: 101, wr: 81.2, pnl: 9947,  rating:"mid"   },
    { k: "8–14 d",   n: 19,  wr: 94.7, pnl: 43534, rating:"good"  },
    { k: "15–30 d",  n: 7,   wr: 42.9, pnl: -13790, rating:"bad"  },
    { k: "30 d +",   n: 1,   wr: 100,  pnl: 6866,  rating:"mid"   }
  ],
  byHour: [
    { h: "09:00", n: 196, wr: 86.2 },
    { h: "10:00", n: 61,  wr: 88.5 },
    { h: "11:00", n: 25,  wr: 96.0 },
    { h: "12:00", n: 4,   wr: 75.0 },
    { h: "14:00", n: 2,   wr: 100 },
    { h: "15:00", n: 1,   wr: 100 }
  ],
  byBucket: [
    { k: "Deep OTM", sub: "< ₹5",        n: 2,   pnl: 1924,  wr: 100 },
    { k: "OTM",      sub: "₹5 – ₹20",    n: 77,  pnl: -4176, wr: 80.5 },
    { k: "Near ATM", sub: "₹20 – ₹50",   n: 124, pnl: 68273, wr: 90.3 },
    { k: "ATM",      sub: "₹50 – ₹150",  n: 86,  pnl: 108820, wr: 89.5 }
  ],
  cepe: [
    { t: "CE", n: 98, pnl: 84268, wr: 88.8, avg: 860 },
    { t: "PE", n: 58, pnl: 69236, wr: 93.1, avg: 1194 }
  ],
  equity: {
    gross: 6126, net: -1924, charges: 8049, wins: 24, losses: 29,
    wr: 45.3, avgHold: 43.7, total: 53,
    stocks: [
      { sym:"CAMS",       pnl:  17371, n: 9, wr: 100 },
      { sym:"GOLDBEES",   pnl:   5130, n: 1, wr: 100 },
      { sym:"HCLTECH",    pnl:   3245, n: 5, wr: 100 },
      { sym:"COALINDIA",  pnl:    173, n: 1, wr: 100 },
      { sym:"BHARATFORG", pnl:   -114, n: 1, wr: 0 },
      { sym:"ASHOKA",     pnl:   -614, n: 2, wr: 0 },
      { sym:"GRSE",       pnl:  -1530, n: 2, wr: 0 },
      { sym:"MODEFENCE",  pnl:  -1881, n: 3, wr: 0 },
      { sym:"CDSL",       pnl:  -2061, n: 2, wr: 0 },
      { sym:"MAZDOCK",    pnl:  -6402, n: 2, wr: 0 },
      { sym:"OFSS",       pnl:  -7192, n:25, wr: 32 }
    ],
    trades: []
  },
  trades: [
    { sym:"NIFTY26MAR23700CE", stk:"NIFTY", type:"CE", entry:56.4,  exit:124.5, pnl:2301,    pct:120.7, d:3, k:"pos",   win:true,  close:"2026-03-30", open_date:"2026-03-27", lots:0.9, open_hour:9 },
    { sym:"NIFTY26MAR22000PE", stk:"NIFTY", type:"PE", entry:12.0,  exit:40.9,  pnl:2044,    pct:240.8, d:3, k:"pos",   win:true,  close:"2026-03-30", open_date:"2026-03-27", lots:0.9, open_hour:9 },
    { sym:"BEL26MAR450CE",     stk:"BEL",   type:"CE", entry:8.4,   exit:58.4,  pnl:7553,    pct:595.2, d:8, k:"pos",   win:true,  close:"2026-03-24", open_date:"2026-03-16", lots:1.0, open_hour:9 },
    { sym:"HAL26MAR5000CE",    stk:"HAL",   type:"CE", entry:41.3,  exit:87.6,  pnl:7388,    pct:112.2, d:4, k:"pos",   win:true,  close:"2025-11-24", open_date:"2025-11-20", lots:1.0, open_hour:9 },
    { sym:"OFSS25SEP8700CE",   stk:"OFSS",  type:"CE", entry:145.2, exit:39.5,  pnl:-21863,  pct:-72.8, d:5, k:"pos",   win:false, close:"2025-09-10", open_date:"2025-09-05", lots:1.0, open_hour:9 },
    { sym:"OFSS26JAN8800CE",   stk:"OFSS",  type:"CE", entry:98.0,  exit:220.5, pnl:6866,    pct:125.0, d:31,k:"pos",   win:true,  close:"2026-01-22", open_date:"2025-12-22", lots:1.0, open_hour:9 },
    { sym:"INFY25DEC1500CE",   stk:"INFY",  type:"CE", entry:22.4,  exit:106.0, pnl:4240,    pct:373.2, d:2, k:"pos",   win:true,  close:"2026-02-05", open_date:"2026-02-03", lots:1.0, open_hour:9 },
    { sym:"INFY25SEP1400PE",   stk:"INFY",  type:"PE", entry:10.3,  exit:5.8,   pnl:1800,    pct:-43.7, d:4, k:"pos",   win:true,  close:"2025-08-25", open_date:"2025-08-21", lots:1.0, open_hour:9 },
    { sym:"CAMS25OCT3700CE",   stk:"CAMS",  type:"CE", entry:64.0,  exit:127.4, pnl:2903,    pct:99.1,  d:2, k:"pos",   win:true,  close:"2025-10-03", open_date:"2025-10-01", lots:1.0, open_hour:9 },
    { sym:"SENSEX25OCT82000CE",stk:"SENSEX",type:"CE", entry:138.0, exit:182.2, pnl:788,     pct:32.0,  d:1, k:"pos",   win:true,  close:"2025-10-30", open_date:"2025-10-29", lots:2.0, open_hour:9 },
    { sym:"NIFTY25N0425850CE", stk:"NIFTY", type:"CE", entry:28.5,  exit:79.8,  pnl:2295,    pct:180.0, d:1, k:"pos",   win:true,  close:"2025-11-04", open_date:"2025-11-03", lots:1.5, open_hour:9 },
    { sym:"BANKNIFTY25DEC51000PE", stk:"BANK-N", type:"PE", entry:82.0, exit:132.5, pnl:1138, pct:61.6, d:2, k:"pos", win:true, close:"2025-12-11", open_date:"2025-12-09", lots:1.0, open_hour:9 },
    { sym:"HAL25OCT4800PE",    stk:"HAL",   type:"PE", entry:32.1,  exit:18.5,  pnl:-10560,  pct:-42.4, d:11,k:"pos",   win:false, close:"2025-10-28", open_date:"2025-10-17", lots:1.0, open_hour:9 },
    { sym:"NIFTY25D0925600PE", stk:"NIFTY", type:"PE", entry:22.8,  exit:44.2,  pnl:1616,    pct:94.1,  d:2, k:"pos",   win:true,  close:"2025-12-05", open_date:"2025-12-03", lots:1.5, open_hour:9 },
    { sym:"OFSS25NOV8500PE",   stk:"OFSS",  type:"PE", entry:88.5,  exit:225.0, pnl:5118,    pct:154.0, d:12,k:"pos",   win:true,  close:"2026-02-03", open_date:"2026-01-22", lots:1.0, open_hour:9 },
    { sym:"HAL25NOV4500CE",    stk:"HAL",   type:"CE", entry:18.2,  exit:42.6,  pnl:1830,    pct:134.0, d:0, k:"intra", win:true,  close:"2025-10-08", open_date:"2025-10-08", lots:1.0, open_hour:9 },
    { sym:"NIFTY26JAN23500PE", stk:"NIFTY", type:"PE", entry:48.3,  exit:94.0,  pnl:3429,    pct:94.6,  d:2, k:"pos",   win:true,  close:"2026-01-13", open_date:"2026-01-12", lots:1.3, open_hour:9 },
    { sym:"INFY26FEB1750PE",   stk:"INFY",  type:"PE", entry:15.4,  exit:3.2,   pnl:-6200,   pct:-79.2, d:1, k:"pos",   win:false, close:"2025-09-09", open_date:"2025-09-08", lots:1.0, open_hour:10 },
    { sym:"CAMS26MAR3800CE",   stk:"CAMS",  type:"CE", entry:52.0,  exit:110.0, pnl:1740,    pct:111.5, d:8, k:"pos",   win:true,  close:"2025-10-15", open_date:"2025-10-07", lots:1.0, open_hour:9 },
    { sym:"HAL25DEC4900CE",    stk:"HAL",   type:"CE", entry:28.5,  exit:0.50,  pnl:-4340,   pct:-98.2, d:0, k:"intra", win:false, close:"2025-12-09", open_date:"2025-12-09", lots:1.0, open_hour:9 },
    { sym:"BEL25OCT440CE",     stk:"BEL",   type:"CE", entry:9.8,   exit:18.2,  pnl:1260,    pct:85.7,  d:8, k:"pos",   win:true,  close:"2026-03-13", open_date:"2026-03-05", lots:1.0, open_hour:9 },
    { sym:"NIFTY25DEC24500CE", stk:"NIFTY", type:"CE", entry:78.0,  exit:195.0, pnl:4388,    pct:150.0, d:4, k:"pos",   win:true,  close:"2025-12-22", open_date:"2025-12-18", lots:2.0, open_hour:9 },
    { sym:"OFSS25OCF8900PE",   stk:"OFSS",  type:"PE", entry:110.0, exit:48.0,  pnl:-3100,   pct:-56.4, d:17,k:"pos",   win:false, close:"2025-10-27", open_date:"2025-10-10", lots:1.0, open_hour:10 },
    { sym:"INFY25NOV1600CE",   stk:"INFY",  type:"CE", entry:42.8,  exit:88.5,  pnl:3200,    pct:106.8, d:6, k:"pos",   win:true,  close:"2026-02-12", open_date:"2026-02-06", lots:1.0, open_hour:10 },
    { sym:"BANKNIFTY25OCT52000CE", stk:"BANK-N", type:"CE", entry:65.0, exit:142.0, pnl:2310, pct:118.5, d:13,k:"pos", win:true, close:"2026-01-21", open_date:"2026-01-07", lots:1.0, open_hour:9 },
    { sym:"HAL26JAN5200CE",    stk:"HAL",   type:"CE", entry:35.0,  exit:82.5,  pnl:4275,    pct:135.7, d:14,k:"pos",   win:true,  close:"2026-01-21", open_date:"2026-01-07", lots:1.0, open_hour:9 },
    { sym:"NIFTY26MAR23000PE", stk:"NIFTY", type:"PE", entry:36.2,  exit:6.5,   pnl:-2228,   pct:-82.0, d:5, k:"pos",   win:false, close:"2026-01-12", open_date:"2026-01-07", lots:1.3, open_hour:9 },
    { sym:"CAMS25NOV3600PE",   stk:"CAMS",  type:"PE", entry:48.0,  exit:62.5,  pnl:435,     pct:30.2,  d:0, k:"intra", win:true,  close:"2025-10-29", open_date:"2025-10-29", lots:1.0, open_hour:9 },
    { sym:"SENSEX25NOV81000PE",stk:"SENSEX",type:"PE", entry:128.0, exit:168.5, pnl:405,     pct:31.6,  d:0, k:"intra", win:true,  close:"2025-10-29", open_date:"2025-10-29", lots:2.0, open_hour:9 },
    { sym:"BEL25DEC460PE",     stk:"BEL",   type:"PE", entry:7.2,   exit:22.0,  pnl:2220,    pct:205.5, d:3, k:"pos",   win:true,  close:"2026-03-16", open_date:"2026-03-13", lots:1.0, open_hour:9 }
  ]
};