export interface CityLocality {
  name: string;
  city: 'Indore' | 'Bhopal' | 'Ujjain' | 'Dewas';
  pincode: string;
  coords: { lat: number; lng: number };
  popularLandmarks: string[];
}

export const MP_LOCALITIES: CityLocality[] = [
  // --- INDORE ---
  {
    name: 'Vijay Nagar',
    city: 'Indore',
    pincode: '452010',
    coords: { lat: 22.7533, lng: 75.8937 },
    popularLandmarks: ['Brilliant Convention Centre', 'C21 Mall', 'Malhar Mega Mall', 'Sayaji Hotel'],
  },
  {
    name: 'Palasia (Old & New)',
    city: 'Indore',
    pincode: '452001',
    coords: { lat: 22.7244, lng: 75.8839 },
    popularLandmarks: ['56 Dukan', 'Industry House', 'Geeta Bhawan Square', 'Manorama Ganj'],
  },
  {
    name: 'Bhanwarkuan & Tower Square',
    city: 'Indore',
    pincode: '452014',
    coords: { lat: 22.6931, lng: 75.8668 },
    popularLandmarks: ['DAVV Campus', 'Vishnupuri Colony', 'Bholaram Ustad Marg', 'Sapna Sangeeta Road'],
  },
  {
    name: 'Rajwada & Sarafa',
    city: 'Indore',
    pincode: '452002',
    coords: { lat: 22.7196, lng: 75.8577 },
    popularLandmarks: ['Rajwada Palace', 'Sarafa Bazaar', 'Krishnapura Chhatri', 'Sitlamata Bazaar'],
  },
  {
    name: 'Scheme No. 54 & Scheme 78',
    city: 'Indore',
    pincode: '452010',
    coords: { lat: 22.7612, lng: 75.8984 },
    popularLandmarks: ['Satya Sai Square', 'Medanta Hospital', 'Prestige Institute'],
  },
  {
    name: 'Annapurna & Sudama Nagar',
    city: 'Indore',
    pincode: '452009',
    coords: { lat: 22.6989, lng: 75.8341 },
    popularLandmarks: ['Annapurna Temple', 'Usha Nagar', 'Dravid Nagar', 'Ranjeet Hanuman Temple'],
  },
  {
    name: 'Rau & Silicon City',
    city: 'Indore',
    pincode: '453331',
    coords: { lat: 22.6289, lng: 75.8086 },
    popularLandmarks: ['Silicon City Gate', 'Rau Circle', 'Emerald Heights School', 'Cat Road'],
  },
  {
    name: 'Super Corridor & MR 10',
    city: 'Indore',
    pincode: '452005',
    coords: { lat: 22.7785, lng: 75.8291 },
    popularLandmarks: ['TCS Campus', 'Infosys IT Park', 'Tigaria Badshah', 'Gandhi Nagar'],
  },
  {
    name: 'Mahalaxmi Nagar & Nipania',
    city: 'Indore',
    pincode: '452010',
    coords: { lat: 22.7681, lng: 75.9082 },
    popularLandmarks: ['Bombay Hospital', 'Tulsi Nagar', 'Nipania Main Road'],
  },
  {
    name: 'Bengali Square & Kanadia Road',
    city: 'Indore',
    pincode: '452016',
    coords: { lat: 22.7214, lng: 75.9123 },
    popularLandmarks: ['Bengali Square Flyover', 'Sanchar Nagar', 'Vaibhav Nagar', 'Goyal Nagar'],
  },

  // --- BHOPAL ---
  {
    name: 'MP Nagar (Zone I & II)',
    city: 'Bhopal',
    pincode: '462011',
    coords: { lat: 23.2332, lng: 77.4343 },
    popularLandmarks: ['DB City Mall', 'Jyoti Cinema', 'Chetak Bridge', 'Pragati Petrol Pump'],
  },
  {
    name: 'Arera Colony (E1-E7)',
    city: 'Bhopal',
    pincode: '462016',
    coords: { lat: 23.2132, lng: 77.4347 },
    popularLandmarks: ['10 No. Market', 'Bittan Market', 'National Hospital', 'Manit Square'],
  },
  {
    name: 'Kolar Road',
    city: 'Bhopal',
    pincode: '462042',
    coords: { lat: 23.1784, lng: 77.4192 },
    popularLandmarks: ['D-Mart Kolar', 'Sarvadharam Colony', 'Bairagarh Chichali', 'Lalita Nagar'],
  },
  {
    name: 'New Market & TT Nagar',
    city: 'Bhopal',
    pincode: '462003',
    coords: { lat: 23.2396, lng: 77.4022 },
    popularLandmarks: ['Top n Town Square', 'Roshanpura Square', 'Tatya Tope Stadium', 'Rangmahal'],
  },
  {
    name: 'Hoshangabad Road & Misrod',
    city: 'Bhopal',
    pincode: '462026',
    coords: { lat: 23.1873, lng: 77.4642 },
    popularLandmarks: ['Aashima Mall', 'Barkatullah University', 'AIIMS Bhopal', 'C21 Mall Bhopal'],
  },
  {
    name: 'Ayodhya Bypass & BHEL',
    city: 'Bhopal',
    pincode: '462022',
    coords: { lat: 23.2678, lng: 77.4721 },
    popularLandmarks: ['Govindpura Industrial Area', 'Kasturba Hospital', 'Minal Residency'],
  },

  // --- UJJAIN ---
  {
    name: 'Freeganj Commercial Hub',
    city: 'Ujjain',
    pincode: '456010',
    coords: { lat: 23.1765, lng: 75.7885 },
    popularLandmarks: ['Tower Chowk', 'Madhav Club Road', 'Chamunda Mata Temple', 'Overbridge'],
  },
  {
    name: 'Mahakal Mandir Marg & Jaisinghpura',
    city: 'Ujjain',
    pincode: '456006',
    coords: { lat: 23.1827, lng: 75.7682 },
    popularLandmarks: ['Mahakaleshwar Jyotirlinga', 'Mahakal Lok Corridor', 'Ramghat', 'Harsiddhi Temple'],
  },
  {
    name: 'Nanakheda & Sanwer Road',
    city: 'Ujjain',
    pincode: '456010',
    coords: { lat: 23.1539, lng: 75.7954 },
    popularLandmarks: ['Nanakheda Bus Stand', 'Mata Mandir', 'Alakhnanda Nagar'],
  },
  {
    name: 'Rishi Nagar & Sethi Nagar',
    city: 'Ujjain',
    pincode: '456010',
    coords: { lat: 23.1672, lng: 75.7981 },
    popularLandmarks: ['Vikram University', 'Kalidas Academy', 'Kshapnak Marg'],
  },

  // --- DEWAS ---
  {
    name: 'Station Road & Civil Lines',
    city: 'Dewas',
    pincode: '455001',
    coords: { lat: 22.9676, lng: 76.0534 },
    popularLandmarks: ['Dewas Railway Station', 'Collectorate', 'Chamunda Tekri Foot', 'Sayaji Gate'],
  },
  {
    name: 'Vikas Nagar & Alkapuri',
    city: 'Dewas',
    pincode: '455001',
    coords: { lat: 22.9734, lng: 76.0645 },
    popularLandmarks: ['Vikas Nagar Square', 'Mata Mandir', 'Bank Note Press Area'],
  },
  {
    name: 'AB Road & Industrial Area',
    city: 'Dewas',
    pincode: '455001',
    coords: { lat: 22.9556, lng: 76.0421 },
    popularLandmarks: ['Tata Square', 'Gajra Gears Crossing', 'Bhopal Bypass Junction'],
  },
];
