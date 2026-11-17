// Imported from "2026.RELISH-SERVERS_events-1.docx" (Relish servers' payment file, from 11 July 2026).
// Used once by the "Import Relish servers" button on the Staff page; safe to run again.
export const RELISH_STAFF_DOMAIN = "staff.relish.com.hk";
export const IMPORT_NOTE = "Imported from the Relish servers' payment file";

export interface ImportWorker { key: string; name: string; position: "Server" | "Bartender"; senior: boolean; note: string }
export interface ImportShift { day: string; client: string; position: "Server" | "Bartender"; names: string[]; start: string; end: string; break: number; note: string; puree?: { puree_id: string; reference: string | null; title: string; client_name: string | null; state: string | null; order_url: string | null; pax: number | null } }

export const IMPORT_WORKERS: ImportWorker[] = [
  {
    "key": "aaisha",
    "name": "Aaisha",
    "position": "Server",
    "senior": false,
    "note": "New in Aug 2026 – details on WhatsApp"
  },
  {
    "key": "catherine",
    "name": "Catherine",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "catrina",
    "name": "Catrina",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "eddie",
    "name": "Eddie",
    "position": "Server",
    "senior": true,
    "note": ""
  },
  {
    "key": "freny",
    "name": "Freny",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "gene",
    "name": "Gene",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "hiedy",
    "name": "Hiedy",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "jacqueline",
    "name": "Jacqueline",
    "position": "Server",
    "senior": true,
    "note": ""
  },
  {
    "key": "john",
    "name": "John",
    "position": "Server",
    "senior": false,
    "note": "New in Aug 2026 – details on WhatsApp"
  },
  {
    "key": "kathy",
    "name": "Kathy",
    "position": "Bartender",
    "senior": false,
    "note": ""
  },
  {
    "key": "kelly",
    "name": "Kelly",
    "position": "Bartender",
    "senior": false,
    "note": ""
  },
  {
    "key": "leony",
    "name": "Leony",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "lynn",
    "name": "Lynn",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "marc",
    "name": "Marc",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "nich",
    "name": "Nich",
    "position": "Bartender",
    "senior": false,
    "note": "Bartender – personal information in the bartender folder"
  },
  {
    "key": "niejel",
    "name": "Niejel",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "pauline",
    "name": "Pauline",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "perry",
    "name": "Wong Wai Hung (Perry)",
    "position": "Server",
    "senior": false,
    "note": "Gingers' server. Bank: CMB Wing Lung Bank Limited, 60920509952"
  },
  {
    "key": "polly",
    "name": "Li Wing Kam (Polly)",
    "position": "Server",
    "senior": false,
    "note": "Gingers' server. Bank: Hang Seng Bank, 280-3-114756"
  },
  {
    "key": "ramin",
    "name": "Ramin",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "ricky",
    "name": "Ricky",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "sasha",
    "name": "Sasha",
    "position": "Bartender",
    "senior": false,
    "note": "New bartender, Nov 2026"
  },
  {
    "key": "truly",
    "name": "Truly",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "uday",
    "name": "Uday",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "warren",
    "name": "Warren",
    "position": "Server",
    "senior": false,
    "note": ""
  },
  {
    "key": "washam",
    "name": "Washam",
    "position": "Bartender",
    "senior": false,
    "note": ""
  },
  {
    "key": "yulie",
    "name": "Yulie",
    "position": "Server",
    "senior": true,
    "note": ""
  }
];

export const IMPORT_SHIFTS: ImportShift[] = [
  {
    "day": "2026-07-29",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Niejel",
      "Uday"
    ],
    "start": "09:00",
    "end": "19:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-07-30",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Niejel",
      "Uday"
    ],
    "start": "09:00",
    "end": "19:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-07-31",
    "client": "Ann on Board",
    "position": "Server",
    "names": [
      "Yulie",
      "Marc",
      "Niejel"
    ],
    "start": "12:00",
    "end": "18:00",
    "break": 0,
    "note": "Service time 6 hours (exact times not in the file)"
  },
  {
    "day": "2026-08-03",
    "client": "McKinsey & Company",
    "position": "Server",
    "names": [
      "Polly",
      "Perry"
    ],
    "start": "12:00",
    "end": "18:00",
    "break": 0,
    "note": "Service time 6 hours (exact times not in the file). 2 Gingers' servers"
  },
  {
    "day": "2026-08-26",
    "client": "Freshfields",
    "position": "Server",
    "names": [
      "Freny"
    ],
    "start": "16:30",
    "end": "22:30",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-08-27",
    "client": "Cooley",
    "position": "Server",
    "names": [
      "Freny",
      "Niejel"
    ],
    "start": "11:30",
    "end": "19:30",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-08-29",
    "client": "Catherine Kelly",
    "position": "Server",
    "names": [
      "Uday"
    ],
    "start": "17:00",
    "end": "23:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-08-30",
    "client": "Natalie Bat Mitzvah",
    "position": "Server",
    "names": [
      "Marc",
      "John",
      "Lynn",
      "Catrina"
    ],
    "start": "16:00",
    "end": "22:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-08-30",
    "client": "Natalie Bat Mitzvah",
    "position": "Server",
    "names": [
      "Hiedy",
      "Catherine",
      "Aaisha"
    ],
    "start": "16:00",
    "end": "00:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-08-30",
    "client": "Natalie Bat Mitzvah",
    "position": "Server",
    "names": [
      "Niejel",
      "Yulie",
      "Ramin",
      "Gene",
      "Ricky",
      "Uday",
      "Truly",
      "Freny",
      "Leony",
      "Warren"
    ],
    "start": "14:00",
    "end": "00:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-08-30",
    "client": "Natalie Bat Mitzvah",
    "position": "Bartender",
    "names": [
      "Nich",
      "Kelly",
      "Kathy"
    ],
    "start": "16:00",
    "end": "22:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-01",
    "client": "UBS",
    "position": "Server",
    "names": [
      "Niejel",
      "Uday"
    ],
    "start": "06:30",
    "end": "15:00",
    "break": 90,
    "note": "Split shift 6:30–9:30 + 11:00–15:00 (7 hours)"
  },
  {
    "day": "2026-09-02",
    "client": "UBS",
    "position": "Server",
    "names": [
      "Niejel",
      "Uday"
    ],
    "start": "06:30",
    "end": "10:30",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-06",
    "client": "Erin Choi",
    "position": "Server",
    "names": [
      "Freny",
      "Warren"
    ],
    "start": "13:00",
    "end": "19:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-08",
    "client": "Hongkong Land",
    "position": "Server",
    "names": [
      "Freny",
      "Niejel",
      "Uday",
      "Marc",
      "Ramin",
      "Pauline"
    ],
    "start": "14:00",
    "end": "18:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-10",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Niejel",
      "Uday"
    ],
    "start": "09:00",
    "end": "19:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-11",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Niejel",
      "Uday"
    ],
    "start": "09:00",
    "end": "19:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-13",
    "client": "New Zealand Residence",
    "position": "Server",
    "names": [
      "Freny"
    ],
    "start": "17:00",
    "end": "22:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-15",
    "client": "Bank of America",
    "position": "Server",
    "names": [
      "Freny",
      "Ramin"
    ],
    "start": "11:30",
    "end": "19:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-15",
    "client": "Bridget Barnett",
    "position": "Server",
    "names": [
      "Ricky",
      "Hiedy"
    ],
    "start": "17:15",
    "end": "21:15",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-15",
    "client": "Bridget Barnett",
    "position": "Bartender",
    "names": [
      "Nich"
    ],
    "start": "17:15",
    "end": "21:15",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-15",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Pauline",
      "Uday"
    ],
    "start": "09:00",
    "end": "21:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-15",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Marc"
    ],
    "start": "17:00",
    "end": "21:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-16",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Pauline",
      "Uday"
    ],
    "start": "09:00",
    "end": "19:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-21",
    "client": "Jebsen",
    "position": "Server",
    "names": [
      "Niejel",
      "Jacqueline"
    ],
    "start": "11:00",
    "end": "15:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-22",
    "client": "Bank of America",
    "position": "Server",
    "names": [
      "Uday",
      "Freny",
      "Marc"
    ],
    "start": "17:00",
    "end": "22:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "37752",
      "reference": "2.1",
      "title": "Great Gatsby Theme",
      "client_name": "Bank of America",
      "state": "accepted",
      "order_url": "https://puree.app/orders/37752",
      "pax": null
    }
  },
  {
    "day": "2026-09-22",
    "client": "Bank of America",
    "position": "Bartender",
    "names": [
      "Washam"
    ],
    "start": "16:00",
    "end": "22:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "37752",
      "reference": "2.1",
      "title": "Great Gatsby Theme",
      "client_name": "Bank of America",
      "state": "accepted",
      "order_url": "https://puree.app/orders/37752",
      "pax": null
    }
  },
  {
    "day": "2026-09-23",
    "client": "Phillips",
    "position": "Server",
    "names": [
      "Freny",
      "Marc"
    ],
    "start": "14:30",
    "end": "19:30",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-23",
    "client": "Phillips",
    "position": "Server",
    "names": [
      "Yulie"
    ],
    "start": "14:30",
    "end": "20:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-23",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Pauline",
      "Uday"
    ],
    "start": "09:00",
    "end": "19:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-24",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Uday"
    ],
    "start": "09:00",
    "end": "19:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-25",
    "client": "Jebsen",
    "position": "Server",
    "names": [
      "Yulie",
      "Jacqueline"
    ],
    "start": "15:30",
    "end": "22:45",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "39037",
      "reference": "10.2",
      "title": "Jebsen",
      "client_name": "Jebsen",
      "state": "accepted",
      "order_url": "https://puree.app/orders/39037",
      "pax": 30
    }
  },
  {
    "day": "2026-09-26",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Pauline",
      "Uday"
    ],
    "start": "09:00",
    "end": "19:00",
    "break": 0,
    "note": "PUBLIC HOLIDAY, DOUBLE PAY"
  },
  {
    "day": "2026-09-27",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Uday"
    ],
    "start": "09:00",
    "end": "19:00",
    "break": 0,
    "note": ""
  },
  {
    "day": "2026-09-27",
    "client": "Andrea Fessler",
    "position": "Server",
    "names": [
      "Pauline",
      "Truly"
    ],
    "start": "14:00",
    "end": "20:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "38889",
      "reference": "9.1",
      "title": "Andrea Fessler",
      "client_name": "Andrea Fessler",
      "state": "accepted",
      "order_url": "https://puree.app/orders/38889",
      "pax": 40
    }
  },
  {
    "day": "2026-10-10",
    "client": "Erin Choi",
    "position": "Server",
    "names": [
      "Freny",
      "Pauline"
    ],
    "start": "13:30",
    "end": "19:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "41212",
      "reference": "48.1",
      "title": "Konor’s Birthday Party",
      "client_name": "Erin Choi ",
      "state": "accepted",
      "order_url": "https://puree.app/orders/41212",
      "pax": null
    }
  },
  {
    "day": "2026-10-12",
    "client": "Jebsen Capital",
    "position": "Server",
    "names": [
      "Marc",
      "Ramin",
      "Ricky"
    ],
    "start": "15:30",
    "end": "19:30",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "40724",
      "reference": "42.1",
      "title": "Jebsen Capital",
      "client_name": "Jebsen Capital",
      "state": "accepted",
      "order_url": "https://puree.app/orders/40724",
      "pax": 60
    }
  },
  {
    "day": "2026-10-13",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Uday"
    ],
    "start": "13:00",
    "end": "18:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "41956",
      "reference": "74.1",
      "title": "Aldar",
      "client_name": "Aldar",
      "state": "accepted",
      "order_url": "https://puree.app/orders/41956",
      "pax": 35
    }
  },
  {
    "day": "2026-10-17",
    "client": "Aldar",
    "position": "Server",
    "names": [
      "Uday",
      "Pauline"
    ],
    "start": "12:00",
    "end": "18:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "43177",
      "reference": "89.1",
      "title": "Aldar",
      "client_name": "Aldar",
      "state": "accepted",
      "order_url": "https://puree.app/orders/43177",
      "pax": 35
    }
  },
  {
    "day": "2026-10-20",
    "client": "Australian Consulate",
    "position": "Server",
    "names": [
      "Freny"
    ],
    "start": "16:30",
    "end": "20:30",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "43634",
      "reference": "97.1",
      "title": "Australian Consulate-General Hong Kong",
      "client_name": "Australian Consulate-General Hong Kong",
      "state": "accepted",
      "order_url": "https://puree.app/orders/43634",
      "pax": 22
    }
  },
  {
    "day": "2026-10-22",
    "client": "Cooley",
    "position": "Server",
    "names": [
      "Freny"
    ],
    "start": "12:00",
    "end": "19:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "39824",
      "reference": "31.1",
      "title": "Cooley",
      "client_name": "Cooley",
      "state": "accepted",
      "order_url": "https://puree.app/orders/39824",
      "pax": 45
    }
  },
  {
    "day": "2026-10-27",
    "client": "Caterina B.D.P.",
    "position": "Bartender",
    "names": [
      "Nich"
    ],
    "start": "17:30",
    "end": "22:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "42210",
      "reference": "80.1",
      "title": "Caterina Bernardini De Pace",
      "client_name": "Caterina Bernardini De Pace",
      "state": "accepted",
      "order_url": "https://puree.app/orders/42210",
      "pax": 30
    }
  },
  {
    "day": "2026-10-30",
    "client": "Stephen Wong",
    "position": "Server",
    "names": [
      "Truly",
      "Pauline"
    ],
    "start": "16:00",
    "end": "23:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "42482",
      "reference": "84.1",
      "title": "Stephen Wong ",
      "client_name": "Stephen Wong ",
      "state": "accepted",
      "order_url": "https://puree.app/orders/42482",
      "pax": null
    }
  },
  {
    "day": "2026-10-30",
    "client": "Bridget Barnett",
    "position": "Server",
    "names": [
      "Ricky"
    ],
    "start": "19:00",
    "end": "23:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "46759",
      "reference": "151.1",
      "title": "Bridget Barnett",
      "client_name": "Bridget Barnett",
      "state": "accepted",
      "order_url": "https://puree.app/orders/46759",
      "pax": null
    }
  },
  {
    "day": "2026-10-31",
    "client": "Nathan Savir",
    "position": "Server",
    "names": [
      "Truly",
      "Freny"
    ],
    "start": "13:00",
    "end": "22:30",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "42448",
      "reference": "82.1",
      "title": "A Night to Die For",
      "client_name": "Nathan",
      "state": "accepted",
      "order_url": "https://puree.app/orders/42448",
      "pax": null
    }
  },
  {
    "day": "2026-10-31",
    "client": "Caroline Link",
    "position": "Server",
    "names": [
      "Ricky",
      "Hiedy"
    ],
    "start": "18:00",
    "end": "01:00",
    "break": 0,
    "note": "Taxi paid to Hiedy, receipt in the folder",
    "puree": {
      "puree_id": "44786",
      "reference": "107.1",
      "title": "Caroline Link",
      "client_name": "Caroline Link",
      "state": "accepted",
      "order_url": "https://puree.app/orders/44786",
      "pax": 20
    }
  },
  {
    "day": "2026-10-31",
    "client": "Caroline Link",
    "position": "Bartender",
    "names": [
      "Nich"
    ],
    "start": "19:00",
    "end": "00:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "44786",
      "reference": "107.1",
      "title": "Caroline Link",
      "client_name": "Caroline Link",
      "state": "accepted",
      "order_url": "https://puree.app/orders/44786",
      "pax": 20
    }
  },
  {
    "day": "2026-11-01",
    "client": "Jebsen",
    "position": "Server",
    "names": [
      "Freny"
    ],
    "start": "17:30",
    "end": "23:30",
    "break": 0,
    "note": "Vivian send salary to Polly, time TBC with Mike",
    "puree": {
      "puree_id": "43620",
      "reference": "96.1",
      "title": "Jebsen",
      "client_name": "Jebsen",
      "state": "accepted",
      "order_url": "https://puree.app/orders/43620",
      "pax": null
    }
  },
  {
    "day": "2026-11-07",
    "client": "Princess Yachts",
    "position": "Server",
    "names": [
      "Yulie",
      "Uday",
      "Marc"
    ],
    "start": "10:00",
    "end": "19:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "42422",
      "reference": "81.1",
      "title": "Princess Yachts",
      "client_name": "Princess Yachts",
      "state": "accepted",
      "order_url": "https://puree.app/orders/42422",
      "pax": 50
    }
  },
  {
    "day": "2026-11-07",
    "client": "Princess Yachts",
    "position": "Bartender",
    "names": [
      "Sasha"
    ],
    "start": "10:00",
    "end": "19:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "42422",
      "reference": "81.1",
      "title": "Princess Yachts",
      "client_name": "Princess Yachts",
      "state": "accepted",
      "order_url": "https://puree.app/orders/42422",
      "pax": 50
    }
  },
  {
    "day": "2026-11-07",
    "client": "C&N",
    "position": "Server",
    "names": [
      "Freny"
    ],
    "start": "11:30",
    "end": "18:00",
    "break": 0,
    "note": "",
    "puree": {
      "puree_id": "47498",
      "reference": "162.1",
      "title": "C&N",
      "client_name": "C&N",
      "state": "accepted",
      "order_url": "https://puree.app/orders/47498",
      "pax": 4
    }
  }
];
