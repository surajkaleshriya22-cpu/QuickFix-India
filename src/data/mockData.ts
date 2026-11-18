import { ServiceItem, Technician, Booking, CommissionSettings, PayoutRecord, CustomerUser, AdminMasterPaymentConfig, WalletTransaction } from '../types';

export const INITIAL_SERVICES: ServiceItem[] = [
  // Electrician Services
  {
    id: 'elec-fan',
    category: 'electrician',
    title: 'Ceiling Fan Repair & Installation',
    hindiTitle: 'पंखा मरम्मत और फिटिंग',
    description: 'Noise fix, capacitor replacement, regulator wiring, or new fan mounting with heavy hook check.',
    startingPrice: 199,
    durationMinutes: 40,
    rating: 4.88,
    reviewsCount: 1420,
    warrantyDays: 30,
    badge: 'Most Popular',
    included: [
      'Motor bearing inspection & lubrication',
      'Capacitor replacement test (parts extra)',
      'Balancing and noise elimination',
      '30-day post-service guarantee'
    ]
  },
  {
    id: 'elec-switch',
    category: 'electrician',
    title: 'Switch, Socket & Board Repair',
    hindiTitle: 'स्विच और सॉकेट मरम्मत',
    description: 'Fix sparking switches, loose contact sockets, modular switchboard replacement, and indicator fixing.',
    startingPrice: 149,
    durationMinutes: 30,
    rating: 4.82,
    reviewsCount: 980,
    warrantyDays: 30,
    badge: 'Quick 30 Min',
    included: [
      'Diagnostic voltage and earthing test',
      'Up to 3 switches/sockets inspection',
      'Proper insulation tape and wire tucking',
      'Safety load verification'
    ]
  },
  {
    id: 'elec-mcb',
    category: 'electrician',
    title: 'MCB Tripping & Short Circuit Fix',
    hindiTitle: 'एमसीबी ट्रिपिंग और शॉर्ट सर्किट',
    description: 'Diagnose sudden power blackouts, frequently tripping MCB, burnt fuse wires, and phase imbalance.',
    startingPrice: 349,
    durationMinutes: 60,
    rating: 4.93,
    reviewsCount: 650,
    warrantyDays: 60,
    badge: 'Emergency Ready',
    included: [
      'Digital multimeter continuity diagnostics',
      'Distribution box load checking',
      'Neutral-leakage detection',
      'Detailed safety hazard report'
    ]
  },
  {
    id: 'elec-inverter',
    category: 'electrician',
    title: 'Inverter & Battery Wiring Setup',
    hindiTitle: 'इन्वर्टर और बैटरी वायरिंग',
    description: 'Complete backup wiring connection, distilled water check, bypass switch installation, and terminal cleaning.',
    startingPrice: 499,
    durationMinutes: 75,
    rating: 4.89,
    reviewsCount: 420,
    warrantyDays: 90,
    included: [
      'Heavy duty cable crimping',
      'Acid corrosion terminal wash & petroleum jelly',
      'Phase isolation to prevent reverse feed',
      'Load test on fans, lights & TV'
    ]
  },
  {
    id: 'elec-light',
    category: 'electrician',
    title: 'LED Concealed Lights & Chandeliers',
    hindiTitle: 'झूमर और फॉल्स सीलिंग लाइट फिटिंग',
    description: 'False ceiling downlight cutouts, chandelier ceiling anchoring, strip lights, and warm ambient setups.',
    startingPrice: 299,
    durationMinutes: 45,
    rating: 4.79,
    reviewsCount: 510,
    warrantyDays: 30,
    included: [
      'Laser-aligned ceiling mounting',
      'Reinforced toggle bolt anchor for heavy chandeliers',
      'Driver / SMPS connection with safe heat spacing'
    ]
  },

  // Plumber Services
  {
    id: 'plumb-tap',
    category: 'plumber',
    title: 'Tap, Faucet & Mixer Repair',
    hindiTitle: 'नल और मिक्सर मरम्मत',
    description: 'Continuous dripping tap, loose spindle, low water pressure, ceramic disc cartridge replacement.',
    startingPrice: 199,
    durationMinutes: 35,
    rating: 4.91,
    reviewsCount: 1890,
    warrantyDays: 30,
    badge: 'Bestseller',
    included: [
      'Teflon tape sealing on all male threads',
      'Internal spindle washer replacement',
      'Aerator descaling for restored water pressure',
      'High-pressure test against future leakage'
    ]
  },
  {
    id: 'plumb-toilet',
    category: 'plumber',
    title: 'Toilet Cistern & Flush Valve Fix',
    hindiTitle: 'टॉयलेट सिस्टर्न और फ्लश मरम्मत',
    description: 'Non-stop running water in western toilet, faulty syphon valve, inlet ball-cock replacement, dual-flush fix.',
    startingPrice: 299,
    durationMinutes: 50,
    rating: 4.84,
    reviewsCount: 1140,
    warrantyDays: 45,
    badge: 'Water Saver',
    included: [
      'Dual flush button alignment & syphon reset',
      'Inlet shut-off diaphragm replacement',
      'Flange seal check to prevent floor dampness',
      'Complete leak-proof silicone border touchup'
    ]
  },
  {
    id: 'plumb-block',
    category: 'plumber',
    title: 'Drain & Kitchen Sink Unclogging',
    hindiTitle: 'नाली और सिंक की रुकावट हटाना',
    description: 'Clear stubborn hair clogs, grease buildup, bad odor, slow draining kitchen sink, and bathroom traps.',
    startingPrice: 349,
    durationMinutes: 45,
    rating: 4.87,
    reviewsCount: 1320,
    warrantyDays: 30,
    badge: 'Guaranteed Unblock',
    included: [
      'Professional rotary snake cable clearing',
      'P-trap disassembly, wash, and reseal',
      'Chemical-free organic grease dissolution',
      'Fast-flow water drain clearance verification'
    ]
  },
  {
    id: 'plumb-leak',
    category: 'plumber',
    title: 'Concealed Pipe Leakage Detection',
    hindiTitle: 'दीवार में पाइप लीकेज की जांच',
    description: 'Identify wet wall patches, ceiling seepage, burst CPVC/GI pipes, and repair joints without breaking excess tiles.',
    startingPrice: 599,
    durationMinutes: 90,
    rating: 4.94,
    reviewsCount: 780,
    warrantyDays: 90,
    badge: 'Expert Diagnostics',
    included: [
      'Moisture mapping behind wall tiles',
      'Pneumatic pressure drop testing',
      'Surgical tile removal if pipe welding needed',
      '3-month guarantee against recurrent seepage'
    ]
  },
  {
    id: 'plumb-tank',
    category: 'plumber',
    title: 'Overhead Water Tank & Motor Plumbing',
    hindiTitle: 'पानी की टंकी और मोटर फिटिंग',
    description: 'Automatic float ball valve installation, booster pump connection, bypass line valve, and overflow prevention.',
    startingPrice: 449,
    durationMinutes: 60,
    rating: 4.86,
    reviewsCount: 460,
    warrantyDays: 60,
    included: [
      'Heavy-duty brass ball valve replacement',
      'Air-lock release from main pipeline',
      'Vibration damper pad fitting for booster motor'
    ]
  },

  // AC Repair Services (एसी रिपेयर और सर्विस)
  {
    id: 'ac-jet-clean',
    category: 'ac_repair',
    title: 'Split / Window AC Deep Jet Service',
    hindiTitle: 'एसी जेट वाश और केमिकल सर्विस',
    description: 'High-pressure jet pump wash for indoor evaporator coils, outdoor condenser unit cleaning, filter disinfection, and drain tray flush.',
    startingPrice: 499,
    durationMinutes: 60,
    rating: 4.92,
    reviewsCount: 1680,
    warrantyDays: 30,
    badge: 'Cooling Guarantee',
    included: [
      'Indoor blower & high-pressure jet wash with foam jacket',
      'Outdoor unit coil jet cleaning',
      'Gas pressure & temperature differential check',
      'Airflow and cooling temperature test'
    ]
  },
  {
    id: 'ac-gas-charge',
    category: 'ac_repair',
    title: 'AC Gas Leak Check & Full Charge (R32/R410A)',
    hindiTitle: 'एसी गैस लीकेज चेक व रीफिल',
    description: 'Nitrogen pressure testing, flare nut brazing, vacuumization, and 100% pure virgin refrigerant gas recharge with digital manifold gauge.',
    startingPrice: 1499,
    durationMinutes: 75,
    rating: 4.88,
    reviewsCount: 940,
    warrantyDays: 60,
    badge: '100% Pure Gas',
    included: [
      'Nitrogen pressure test to detect micro-leaks',
      'Copper tube brazing & valve replacement',
      'High vacuum pump moisture evacuation',
      'Weight-accurate R32/R410A/R22 gas charging'
    ]
  },
  {
    id: 'ac-pcb-repair',
    category: 'ac_repair',
    title: 'Inverter AC Motherboard & PCB Circuit Fix',
    hindiTitle: 'इन्वर्टर एसी पीसीबी बोर्ड मरम्मत',
    description: 'Diagnose inverter error codes (E1, E6, F3), burnt capacitors, optical coupler fault, sensor error, and compressor drive IC replacement.',
    startingPrice: 799,
    durationMinutes: 90,
    rating: 4.85,
    reviewsCount: 520,
    warrantyDays: 45,
    badge: 'Chip-Level Fix',
    included: [
      'Digital oscilloscope & multimeter diagnosis',
      'PCB component-level micro-soldering',
      'Communication wire insulation & noise choke check',
      'Outdoor fan & compressor frequency sync test'
    ]
  },
  {
    id: 'ac-install-shift',
    category: 'ac_repair',
    title: 'AC Uninstallation & Heavy Bracket Installation',
    hindiTitle: 'एसी फिटिंग और शिफ्टिंग',
    description: 'Pumping down existing refrigerant, wall bracket mounting with laser alignment, core-cut wall sleeve, and copper piping connection.',
    startingPrice: 899,
    durationMinutes: 120,
    rating: 4.89,
    reviewsCount: 710,
    warrantyDays: 60,
    included: [
      'Refrigerant gas lock-in without loss',
      'Anti-vibration outdoor mounting brackets',
      'Proper copper pipe flare & insulation wrapping',
      'Drain line water flow slope alignment'
    ]
  },

  // Fridge & Freezer Repair Services (फ्रिज व फ्रीजर मरम्मत)
  {
    id: 'fridge-cooling-fix',
    category: 'fridge_repair',
    title: 'Refrigerator Not Cooling / Compressor Check',
    hindiTitle: 'फ्रिज कूलिंग व कंप्रेसर जांच',
    description: 'Diagnose warm fridge compartment, continuous humming compressor, relay-overload failure, and capacitor breakdown.',
    startingPrice: 299,
    durationMinutes: 45,
    rating: 4.87,
    reviewsCount: 1320,
    warrantyDays: 30,
    badge: 'Quick Diagnostic',
    included: [
      'Compressor winding resistance & ohm test',
      'PTC relay & overload protector test',
      'Door magnetic gasket sealing test',
      'Safety earthing & voltage stabilizer check'
    ]
  },
  {
    id: 'fridge-gas-charge',
    category: 'fridge_repair',
    title: 'Single/Double Door Refrigerator Gas Charging',
    hindiTitle: 'फ्रिज गैस चार्जिंग (R134a/R600a)',
    description: 'Complete copper capillary tube flush, drier filter replacement, leak detection, and eco-friendly R134a or R600a gas charging.',
    startingPrice: 1199,
    durationMinutes: 60,
    rating: 4.91,
    reviewsCount: 860,
    warrantyDays: 90,
    badge: 'Deep Freeze Restored',
    included: [
      'Filter drier replacement and flare fitting',
      'System vacuuming & moisture extraction',
      'Certified R600a / R134a pure gas charging',
      'Ice formation test in freezer chamber'
    ]
  },
  {
    id: 'fridge-defrost-timer',
    category: 'fridge_repair',
    title: 'Freezer Excessive Ice / Defrost Timer & Bi-metal Fix',
    hindiTitle: 'फ्रीजर बर्फ जमना और डीफ्रॉस्ट हीटर ठीक करना',
    description: 'Fix heavy ice blocks clogging cold airflow to lower fridge, faulty bi-metal thermostat, defrost heater rod, and timer motor.',
    startingPrice: 449,
    durationMinutes: 50,
    rating: 4.83,
    reviewsCount: 640,
    warrantyDays: 60,
    badge: 'Frost-Free Restore',
    included: [
      'Bi-metal sensor temperature response test',
      'Defrost quartz glass heater continuity check',
      'Timer cycle advance test',
      'Drain pipe hot water flush to clear ice blockage'
    ]
  },
  {
    id: 'fridge-inverter-board',
    category: 'fridge_repair',
    title: 'Inverter Refrigerator PCB Circuit Board Repair',
    hindiTitle: 'इन्वर्टर फ्रिज पीसीबी बोर्ड रिपेयर',
    description: 'Direct repair for multi-door & side-by-side smart inverter refrigerators showing blinking LED error codes or sudden power trip.',
    startingPrice: 699,
    durationMinutes: 75,
    rating: 4.86,
    reviewsCount: 410,
    warrantyDays: 45,
    badge: 'Smart Inverter Pro',
    included: [
      'Inverter frequency driver diagnostics',
      'Blown surge protector & MOV replacement',
      'Fan motor PWM signal verification',
      'Factory electronic test cycle run'
    ]
  },

  // Labour / Helper Services. Prices are illustrative starting rates; final scope and duration are confirmed before booking.
  {
    id: 'labour-general-helper',
    category: 'labour',
    title: 'General Labour / Helper',
    hindiTitle: 'सामान्य मजदूर / हेल्पर',
    description: 'Household shifting help, loading and unloading, lifting and carrying, and basic on-site assistance. Final price depends on work scope and hours.',
    startingPrice: 299,
    durationMinutes: 120,
    rating: 0,
    reviewsCount: 0,
    warrantyDays: 0,
    badge: 'Price confirmed before work',
    included: [
      'One helper for the initial two-hour booking slot',
      'Work scope and safety requirements confirmed before acceptance',
      'Extra time or additional helpers quoted separately'
    ]
  },
  {
    id: 'labour-cleanup-helper',
    category: 'labour',
    title: 'Cleaning & Site Helper',
    hindiTitle: 'सफाई और साइट हेल्पर',
    description: 'General cleaning assistance, material movement, and non-specialist site support. Specialist construction or hazardous work is excluded.',
    startingPrice: 349,
    durationMinutes: 120,
    rating: 0,
    reviewsCount: 0,
    warrantyDays: 0,
    badge: 'Price confirmed before work',
    included: [
      'One helper for the initial two-hour booking slot',
      'Customer and partner agree the task list before starting',
      'Tools, materials, and extra hours quoted separately'
    ]
  },

  // Welder / Fabricator services — starting estimates; final scope and material costs are confirmed before booking.
  {
    id: 'welder-gate-grill-repair', category: 'welder',
    title: 'Gate, Grill & Railing Welding', hindiTitle: 'गेट, ग्रिल और रेलिंग वेल्डिंग',
    description: 'Repair and fabrication of household gates, grills, railings and metal frames. Material and site measurements are quoted separately.',
    startingPrice: 499, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Site estimate may apply',
    included: ['On-site inspection and work-scope confirmation', 'Basic welding labour estimate', 'Metal, paint and consumables charged after approval']
  },
  {
    id: 'welder-furniture-repair', category: 'welder',
    title: 'Metal Furniture Welding', hindiTitle: 'लोहे के फर्नीचर की वेल्डिंग',
    description: 'Repair of metal chairs, tables, racks, beds and similar household items. Heavy or structural work requires a separate site assessment.',
    startingPrice: 399, durationMinutes: 90, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Price confirmed before work',
    included: ['Inspection of the damaged joint', 'Repair labour estimate', 'Parts and finishing quoted separately']
  },
  // Mechanic services
  {
    id: 'mechanic-two-wheeler', category: 'mechanic',
    title: 'Two-Wheeler Inspection & Repair', hindiTitle: 'बाइक / स्कूटर जांच और मरम्मत',
    description: 'Basic two-wheeler diagnosis, battery, brake, chain and starting issue checks. Spare parts and major repairs are quoted separately.',
    startingPrice: 299, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Inspection first',
    included: ['Initial vehicle inspection', 'Fault explanation before repair', 'Parts and additional labour require customer approval']
  },
  {
    id: 'mechanic-car-breakdown', category: 'mechanic',
    title: 'Car Breakdown Assistance', hindiTitle: 'कार खराब होने पर सहायता',
    description: 'Basic roadside diagnosis for starting, battery and minor mechanical issues. Towing and major repairs are not included.',
    startingPrice: 399, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Inspection first',
    included: ['On-site initial diagnosis', 'Repair feasibility and estimate', 'Towing, parts and major work quoted separately']
  },
  // Driver services
  {
    id: 'driver-hourly', category: 'driver',
    title: 'Hourly Personal Driver', hindiTitle: 'घंटे के हिसाब से ड्राइवर',
    description: 'Book a verified driver for your own vehicle. Trip duration, route, waiting and overtime charges are confirmed before the trip.',
    startingPrice: 499, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Trip details confirmed',
    included: ['Driver for the initial two-hour slot', 'Valid driving licence and identity checks', 'Fuel, tolls, parking and extra hours excluded']
  },
  {
    id: 'driver-outstation', category: 'driver',
    title: 'Outstation Driver Booking', hindiTitle: 'आउटस्टेशन यात्रा के लिए ड्राइवर',
    description: 'Driver booking for an outstation journey in the customer vehicle. Route, dates, night halt and return plan must be agreed first.',
    startingPrice: 999, durationMinutes: 480, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Custom trip quote',
    included: ['Driver availability confirmation', 'Route and schedule agreed before acceptance', 'Stay, meals, tolls and extra days quoted separately']
  },
  // Tourist guide services
  {
    id: 'tour-guide-city', category: 'tourist_guide',
    title: 'Local City Sightseeing Guide', hindiTitle: 'शहर घूमने के लिए स्थानीय गाइड',
    description: 'Local guide for popular attractions, local history and a planned city visit. Entry tickets, transport and meals are separate.',
    startingPrice: 799, durationMinutes: 180, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Itinerary confirmed first',
    included: ['Guide for the initial three-hour slot', 'Route and language preference agreed in advance', 'Tickets and transport excluded']
  },
  {
    id: 'tour-guide-custom', category: 'tourist_guide',
    title: 'Custom Local Tour Guide', hindiTitle: 'अपनी पसंद का लोकल टूर गाइड',
    description: 'A guide for a customer-planned local visit, food walk or heritage route. The itinerary and guide credentials are confirmed before booking.',
    startingPrice: 999, durationMinutes: 240, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Custom itinerary',
    included: ['Initial four-hour guide slot', 'Stops and language agreed before booking', 'Tickets, food and transport excluded']
  },
  // Contractor services
  {
    id: 'contractor-site-visit', category: 'contractor',
    title: 'Home Renovation Site Visit', hindiTitle: 'घर के रिनोवेशन के लिए साइट विजिट',
    description: 'Contractor visit for renovation planning, measurements and a preliminary work estimate. Final quotation follows site inspection.',
    startingPrice: 499, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Visit fee estimate',
    included: ['Initial site inspection', 'Work scope and material discussion', 'Detailed BOQ and execution quoted separately']
  },
  {
    id: 'contractor-civil-work', category: 'contractor',
    title: 'Civil Work Consultation', hindiTitle: 'सिविल वर्क सलाह',
    description: 'Consultation for masonry, plaster, tiling and small civil works. Structural changes require qualified assessment and applicable approvals.',
    startingPrice: 599, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Site estimate may apply',
    included: ['Initial work assessment', 'Material and labour scope discussion', 'Execution, materials and permissions quoted separately']
  },
  // Bike Taxi Captain services
  {
    id: 'bike-rider-local-ride', category: 'bike_rider',
    title: 'QuickFix Bike Taxi Ride', hindiTitle: 'क्विकफिक्स बाइक टैक्सी राइड',
    description: 'Local point-to-point bike ride with a verified captain. Fare and route are shown for confirmation before the ride is accepted.',
    startingPrice: 49, durationMinutes: 30, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Fare confirmed before ride',
    included: ['One local point-to-point ride request', 'Captain and vehicle details before pickup', 'Applicable safety, helmet and local transport rules must be followed']
  },
  {
    id: 'bike-rider-parcel', category: 'bike_rider',
    title: 'Local Bike Pickup & Drop', hindiTitle: 'लोकल बाइक पिकअप और ड्रॉप',
    description: 'Local small-item pickup and drop by bike. Restricted, hazardous, illegal or prohibited items are not accepted.',
    startingPrice: 79, durationMinutes: 45, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Distance-based quote',
    included: ['One local pickup and drop request', 'Item and delivery details confirmed before acceptance', 'Distance and waiting charges shown before confirmation']
  },

  // Additional trade-specific work options for every non-core partner category.
  // These are starting estimates only; final scope, materials and travel are confirmed before booking.
  {
    id: 'welder-door-hinge-repair', category: 'welder',
    title: 'Iron Door Hinge & Welding Repair', hindiTitle: 'लोहे के दरवाजे के कब्जे की वेल्डिंग',
    description: 'Repair loose or broken iron door hinges, brackets and small metal joints. Replacement parts and repainting are quoted separately.',
    startingPrice: 299, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Work scope confirmed first',
    included: ['Inspect hinge and metal condition', 'Labour estimate before welding', 'Replacement hinges and paint extra']
  },
  {
    id: 'welder-shed-frame', category: 'welder',
    title: 'Small Shed & Metal Frame Fabrication', hindiTitle: 'शेड और मेटल फ्रेम बनवाना',
    description: 'Fabrication estimate for small household frames, racks and shed supports. Structural load-bearing work needs a qualified site assessment.',
    startingPrice: 699, durationMinutes: 180, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Site measurement required',
    included: ['Basic measurement and design discussion', 'Labour estimate', 'Steel, roofing, transport and structural design extra']
  },
  {
    id: 'welder-window-grill', category: 'welder',
    title: 'Window Grill Repair & Installation', hindiTitle: 'खिड़की की ग्रिल मरम्मत और फिटिंग',
    description: 'Repair or fit household window grills and safety frames after measurements. Materials, anchors and finishing are quoted separately.',
    startingPrice: 449, durationMinutes: 90, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Measurement based quote',
    included: ['Window opening measurement', 'Fitment labour estimate', 'Metal, fasteners and paint extra']
  },
  {
    id: 'mechanic-bike-servicing', category: 'mechanic',
    title: 'Bike / Scooter General Service', hindiTitle: 'बाइक / स्कूटर जनरल सर्विस',
    description: 'Basic scheduled two-wheeler inspection and service including chain, brake and fluid checks. Oil and replacement parts are extra.',
    startingPrice: 399, durationMinutes: 75, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Parts billed separately',
    included: ['Vehicle condition checklist', 'Brake, chain and battery inspection', 'Oil, filters and parts require approval']
  },
  {
    id: 'mechanic-car-battery', category: 'mechanic',
    title: 'Car Battery & Starting Problem Check', hindiTitle: 'कार बैटरी और स्टार्टिंग समस्या जांच',
    description: 'Check weak battery, loose terminals, starter symptoms and charging voltage. Battery replacement and towing are extra.',
    startingPrice: 299, durationMinutes: 45, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Diagnosis first',
    included: ['Battery and terminal inspection', 'Charging voltage check', 'New battery and towing quoted separately']
  },
  {
    id: 'mechanic-puncture', category: 'mechanic',
    title: 'Two-Wheeler Puncture & Tyre Check', hindiTitle: 'बाइक पंचर और टायर जांच',
    description: 'On-site puncture inspection and basic tyre condition check where safe access and repair are possible. Tube or tyre replacement is extra.',
    startingPrice: 149, durationMinutes: 30, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Local assistance',
    included: ['Tyre and valve inspection', 'Repair feasibility confirmation', 'Tube, tyre and parts charged separately']
  },
  {
    id: 'driver-airport-transfer', category: 'driver',
    title: 'Airport / Railway Station Driver', hindiTitle: 'एयरपोर्ट / रेलवे स्टेशन के लिए ड्राइवर',
    description: 'Driver for a pickup or drop in the customer vehicle. Pickup time, waiting, route and return trip are confirmed before booking.',
    startingPrice: 599, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Schedule confirmed first',
    included: ['One scheduled driver assignment', 'Licence and identity verification', 'Fuel, parking, tolls and waiting extra']
  },
  {
    id: 'driver-full-day', category: 'driver',
    title: 'Full-Day Personal Driver', hindiTitle: 'पूरे दिन के लिए पर्सनल ड्राइवर',
    description: 'Book a driver for multiple local stops in the customer vehicle. Duty hours, kilometres, breaks and overtime are agreed in advance.',
    startingPrice: 1199, durationMinutes: 480, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Duty hours confirmed',
    included: ['Initial eight-hour duty slot', 'Route and duty timing agreed', 'Fuel, tolls, parking and overtime extra']
  },
  {
    id: 'driver-business-duty', category: 'driver',
    title: 'Monthly / Regular Driver Enquiry', hindiTitle: 'महीने या नियमित ड्राइवर की मांग',
    description: 'Request a driver for recurring duty. This is an enquiry for availability and terms, not an instant monthly employment confirmation.',
    startingPrice: 199, durationMinutes: 30, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Availability enquiry',
    included: ['Requirement and schedule capture', 'Licence and experience review', 'Monthly pay and terms agreed separately']
  },
  {
    id: 'tour-guide-heritage', category: 'tourist_guide',
    title: 'Heritage & Monument Guided Visit', hindiTitle: 'ऐतिहासिक स्थल और स्मारक गाइड',
    description: 'Guided visit focused on local history and heritage locations. Guide credentials, route and language are confirmed before the visit.',
    startingPrice: 699, durationMinutes: 150, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Guide details confirmed',
    included: ['Initial guided visit slot', 'History and route briefing', 'Entry tickets and transport excluded']
  },
  {
    id: 'tour-guide-food-walk', category: 'tourist_guide',
    title: 'Local Food Walk Guide', hindiTitle: 'लोकल फूड वॉक गाइड',
    description: 'Local guide for a planned food walk and neighbourhood introduction. Food purchases, transport and venue entry are paid separately.',
    startingPrice: 599, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Route agreed first',
    included: ['Initial two-hour guided walk', 'Stops and language agreed in advance', 'Food, drinks and transport excluded']
  },
  {
    id: 'tour-guide-day-trip', category: 'tourist_guide',
    title: 'Nearby Day-Trip Guide', hindiTitle: 'आसपास घूमने के लिए डे-ट्रिप गाइड',
    description: 'Guide enquiry for a nearby day trip with itinerary and meeting point agreed in advance. Transport, tickets and meals are separate.',
    startingPrice: 1299, durationMinutes: 360, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Custom day plan',
    included: ['Initial six-hour guide slot', 'Stops and schedule agreed first', 'Vehicle, tickets and meals excluded']
  },
  {
    id: 'contractor-painting', category: 'contractor',
    title: 'Painting & Waterproofing Estimate', hindiTitle: 'पेंटिंग और वॉटरप्रूफिंग का अनुमान',
    description: 'Site visit to assess interior or exterior painting and basic waterproofing requirements. Materials and execution are quoted after inspection.',
    startingPrice: 399, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Site inspection',
    included: ['Area and surface inspection', 'Preparation and material discussion', 'Paint, chemicals, scaffolding and labour quoted separately']
  },
  {
    id: 'contractor-tiling', category: 'contractor',
    title: 'Tile & Bathroom Renovation Estimate', hindiTitle: 'टाइल और बाथरूम रिनोवेशन अनुमान',
    description: 'Assessment for tile replacement, bathroom upgrades and related civil work. Plumbing changes and waterproofing are separately scoped.',
    startingPrice: 499, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Measurement required',
    included: ['Site measurement and condition check', 'Work sequence discussion', 'Tiles, fittings, debris removal and execution extra']
  },
  {
    id: 'contractor-masonry', category: 'contractor',
    title: 'Masonry & Plaster Repair Estimate', hindiTitle: 'राजमिस्त्री और प्लास्टर मरम्मत अनुमान',
    description: 'Assessment for wall crack repair, plaster patching and small masonry work. Structural cracks need qualified engineering assessment.',
    startingPrice: 399, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Scope confirmed first',
    included: ['Affected area inspection', 'Labour and material estimate', 'Structural repair and permissions excluded']
  },
  {
    id: 'bike-rider-commute', category: 'bike_rider',
    title: 'Daily Commute Bike Ride', hindiTitle: 'रोजाना आने-जाने के लिए बाइक राइड',
    description: 'Request a point-to-point commute ride. Captain availability, pickup, destination, fare and applicable local rules are confirmed before acceptance.',
    startingPrice: 49, durationMinutes: 30, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Fare shown before ride',
    included: ['One local commute request', 'Pickup and drop confirmation', 'Ride subject to local transport permissions and safety rules']
  },
  {
    id: 'bike-rider-urgent-delivery', category: 'bike_rider',
    title: 'Urgent Document / Small Parcel Delivery', hindiTitle: 'जरूरी दस्तावेज / छोटा पार्सल डिलीवरी',
    description: 'Local delivery request for permitted documents and small parcels. Identity, item contents and recipient details are checked before acceptance.',
    startingPrice: 99, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Permitted items only',
    included: ['One local pickup and drop request', 'Recipient and handover details confirmed', 'Cash, valuables, hazardous and prohibited items excluded']
  },
  {
    id: 'bike-rider-errand', category: 'bike_rider',
    title: 'Local Errand Pickup & Drop', hindiTitle: 'लोकल सामान लाना और पहुंचाना',
    description: 'Request a captain for a permitted local errand such as collecting a small order. Purchase cost, waiting and distance are confirmed separately.',
    startingPrice: 99, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Distance-based quote',
    included: ['One local errand request', 'Shop, item and recipient confirmed', 'Item cost, waiting and extra distance charged separately']
  },
  {
    id: 'labour-loading-shifting', category: 'labour',
    title: 'Loading, Unloading & Shifting Helper', hindiTitle: 'सामान चढ़ाने, उतारने और शिफ्टिंग में मदद',
    description: 'Helper for household goods loading, unloading and local shifting assistance. Vehicle, stairs, item weight and number of helpers are quoted separately.',
    startingPrice: 349, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Hours and helpers confirmed',
    included: ['One helper for the initial two-hour slot', 'Item and access conditions confirmed', 'Vehicle, extra helpers and extra hours quoted separately']
  },
  {
    id: 'labour-garden-cleanup', category: 'labour',
    title: 'Garden & Outdoor Cleanup Helper', hindiTitle: 'बगीचे और बाहर की सफाई में मदद',
    description: 'General non-specialist outdoor cleanup and yard assistance. Pesticide use, tree felling and hazardous waste handling are excluded.',
    startingPrice: 399, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Task list confirmed',
    included: ['One helper for the initial two-hour slot', 'Task and access confirmation', 'Tools, disposal and extra hours quoted separately']
  },
  {
    id: 'labour-event-setup', category: 'labour',
    title: 'Event Setup & Furniture Moving Helper', hindiTitle: 'कार्यक्रम सेटअप और फर्नीचर शिफ्टिंग हेल्पर',
    description: 'Helper for arranging chairs, tables and basic event materials. Electrical rigging, heavy lifting equipment and specialist installation are excluded.',
    startingPrice: 399, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Work scope confirmed',
    included: ['One helper for the initial two-hour slot', 'Venue and item details confirmed', 'Equipment, extra helpers and extra hours quoted separately']
  },


  // Expanded practical service menu so every smaller partner trade has at least eight choices.
  {
    id: 'ac-water-drain-repair', category: 'ac_repair',
    title: 'AC Water Leakage & Drain Pipe Repair', hindiTitle: 'एसी से पानी टपकना और ड्रेन पाइप मरम्मत',
    description: 'Inspect blocked drain lines, drain tray and indoor-unit water leakage. Insulation and replacement parts are quoted separately.',
    startingPrice: 299, durationMinutes: 45, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Inspection first',
    included: ['Drain pipe and tray inspection', 'Basic blockage clearing where accessible', 'Replacement pipe, insulation and parts extra']
  },
  {
    id: 'ac-no-cooling-diagnosis', category: 'ac_repair',
    title: 'AC Not Cooling Diagnosis', hindiTitle: 'एसी कूलिंग नहीं कर रहा जांच',
    description: 'Check filters, airflow, sensors, electrical supply and operating pressures to identify cooling issues. Repairs are quoted after diagnosis.',
    startingPrice: 299, durationMinutes: 45, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Diagnosis first',
    included: ['Cooling and airflow checks', 'Basic electrical and sensor inspection', 'Gas, parts and repair work quoted separately']
  },
  {
    id: 'ac-uninstall-reinstall', category: 'ac_repair',
    title: 'AC Uninstallation & Reinstallation', hindiTitle: 'एसी खोलना और दोबारा लगाना',
    description: 'Careful removal or reinstallation of a split or window AC. Copper piping, brackets, core cutting and additional gas are extra.',
    startingPrice: 899, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Site conditions apply',
    included: ['Unit removal or installation labour', 'Basic fitting and operation check', 'Stand, piping, transport and civil work extra']
  },
  {
    id: 'ac-remote-sensor', category: 'ac_repair',
    title: 'AC Remote, Sensor & Thermistor Check', hindiTitle: 'एसी रिमोट और सेंसर जांच',
    description: 'Troubleshoot remote response, receiver board, room sensor and thermistor faults. Replacement devices and boards are extra.',
    startingPrice: 249, durationMinutes: 30, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Parts extra',
    included: ['Remote and receiver response check', 'Sensor wiring inspection', 'Replacement remote, sensor and PCB extra']
  },
  {
    id: 'fridge-defrost-repair', category: 'fridge_repair',
    title: 'Fridge Defrost & Ice Build-up Repair', hindiTitle: 'फ्रिज में बर्फ जमना और डीफ्रॉस्ट मरम्मत',
    description: 'Inspect defrost heater, timer, thermostat and airflow for excess ice build-up. Replacement components are quoted separately.',
    startingPrice: 349, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Diagnosis first',
    included: ['Defrost system inspection', 'Airflow and sensor checks', 'Heater, timer and parts extra']
  },
  {
    id: 'fridge-compressor-check', category: 'fridge_repair',
    title: 'Fridge Compressor & Relay Diagnosis', hindiTitle: 'फ्रिज कंप्रेसर और रिले जांच',
    description: 'Check compressor start relay, overload protector, wiring and running symptoms. Compressor replacement is quoted only after diagnosis.',
    startingPrice: 399, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Diagnosis first',
    included: ['Relay and overload inspection', 'Electrical and start-up checks', 'Compressor and replacement parts extra']
  },
  {
    id: 'fridge-door-gasket', category: 'fridge_repair',
    title: 'Fridge Door Seal & Gasket Replacement', hindiTitle: 'फ्रिज दरवाजे की रबर सील बदलना',
    description: 'Inspect loose or damaged door gasket and alignment causing cooling loss. Correct gasket availability is checked by model.',
    startingPrice: 299, durationMinutes: 45, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Model confirmation',
    included: ['Door seal and alignment inspection', 'Model and gasket size check', 'New gasket and parts extra']
  },
  {
    id: 'fridge-water-dispenser', category: 'fridge_repair',
    title: 'Fridge Water Dispenser & Ice Maker Check', hindiTitle: 'फ्रिज वाटर डिस्पेंसर और आइस मेकर जांच',
    description: 'Troubleshoot dispenser flow, inlet valve, water line and ice maker operation where supported by the model.',
    startingPrice: 299, durationMinutes: 45, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Model dependent',
    included: ['Water line and valve inspection', 'Dispenser or ice maker function check', 'Filters, valves and replacement parts extra']
  },
  {
    id: 'welder-gate-repair', category: 'welder',
    title: 'Main Gate Alignment & Hinge Repair', hindiTitle: 'मेन गेट की अलाइनमेंट और कब्जा मरम्मत',
    description: 'Inspect sagging gates, hinges, latch plates and metal joints. Heavy gate lifting and replacement hardware are extra.',
    startingPrice: 399, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Site inspection',
    included: ['Gate and hinge inspection', 'Basic alignment and welding estimate', 'New hinges, paint and heavy lifting extra']
  },
  {
    id: 'welder-stair-railing', category: 'welder',
    title: 'Staircase & Balcony Railing Repair', hindiTitle: 'सीढ़ी और बालकनी रेलिंग मरम्मत',
    description: 'Repair loose metal railing joints and brackets after a safety inspection. New railing fabrication is quoted separately.',
    startingPrice: 499, durationMinutes: 90, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Safety inspection',
    included: ['Visible joint and bracket inspection', 'Repair labour estimate', 'New metal, finishing and structural redesign extra']
  },
  {
    id: 'welder-metal-rack', category: 'welder',
    title: 'Metal Rack & Storage Stand Fabrication', hindiTitle: 'मेटल रैक और स्टैंड बनवाना',
    description: 'Custom measurement and fabrication estimate for small household racks and stands. Steel and coating are charged separately.',
    startingPrice: 499, durationMinutes: 90, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Custom measurement',
    included: ['Size and load requirement discussion', 'Basic fabrication estimate', 'Metal, coating and delivery extra']
  },
  {
    id: 'mechanic-car-basic-check', category: 'mechanic',
    title: 'Car Basic Health & Fluid Check', hindiTitle: 'कार की बेसिक जांच और फ्लूइड चेक',
    description: 'Basic visual inspection of engine oil, coolant, brake fluid, belts and visible leaks. No roadworthiness certificate is issued.',
    startingPrice: 349, durationMinutes: 45, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Inspection only',
    included: ['Fluid level and visible leak check', 'Belts and hose visual inspection', 'Top-up fluids and repairs extra']
  },
  {
    id: 'mechanic-bike-brake', category: 'mechanic',
    title: 'Bike Brake & Clutch Adjustment', hindiTitle: 'बाइक ब्रेक और क्लच एडजस्टमेंट',
    description: 'Inspect and adjust accessible brake and clutch controls. Worn pads, cables and hydraulic parts are quoted separately.',
    startingPrice: 199, durationMinutes: 35, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Safety check',
    included: ['Brake and clutch free-play inspection', 'Basic adjustment where safe', 'Brake pads, cables and fluid extra']
  },
  {
    id: 'mechanic-car-puncture', category: 'mechanic',
    title: 'Car Tyre Puncture & Pressure Check', hindiTitle: 'कार टायर पंचर और हवा जांच',
    description: 'Inspect tyre puncture and pressure where the vehicle is safely accessible. Sidewall damage and unsafe tyres require replacement.',
    startingPrice: 249, durationMinutes: 35, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Safe repair only',
    included: ['Tyre and valve inspection', 'Pressure check and repair feasibility', 'New tyre, wheel alignment and roadside towing extra']
  },
  {
    id: 'driver-school-duty', category: 'driver',
    title: 'School / Office Pickup & Drop Driver', hindiTitle: 'स्कूल और ऑफिस पिकअप ड्राइवर',
    description: 'Scheduled driver request for recurring pickup and drop in the customer vehicle. Route, timings and guardian handover are agreed first.',
    startingPrice: 499, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Schedule enquiry',
    included: ['Route and timing discussion', 'Licence and identity verification', 'Vehicle, fuel and recurring terms separate']
  },
  {
    id: 'driver-outstation-trip-driver', category: 'driver',
    title: 'Outstation Trip Driver', hindiTitle: 'आउटस्टेशन यात्रा के लिए ड्राइवर',
    description: 'Driver request for an outstation journey using the customer vehicle. Multi-day duty, rest, route and return terms are confirmed first.',
    startingPrice: 999, durationMinutes: 360, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Trip terms confirmed',
    included: ['Trip and route planning', 'Licence and identity verification', 'Fuel, tolls, lodging and driver allowance extra']
  },
  {
    id: 'driver-emergency-replacement', category: 'driver',
    title: 'Short-Notice Replacement Driver', hindiTitle: 'तुरंत दूसरे ड्राइवर की व्यवस्था',
    description: 'Request a replacement driver when the regular driver is unavailable. Availability and arrival time are confirmed before acceptance.',
    startingPrice: 399, durationMinutes: 90, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Availability based',
    included: ['One short local duty request', 'Identity and licence check', 'Waiting, extra hours and travel costs extra']
  },
  {
    id: 'tour-guide-temple', category: 'tourist_guide',
    title: 'Temple & Spiritual Heritage Guide', hindiTitle: 'मंदिर और सांस्कृतिक स्थल गाइड',
    description: 'Local guide for a temple or cultural heritage visit, subject to site rules. Ritual services, donations and transport are not included.',
    startingPrice: 499, durationMinutes: 90, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Site rules apply',
    included: ['Initial guided visit slot', 'Meeting point and language confirmation', 'Donations, entry tickets and transport excluded']
  },
  {
    id: 'tour-guide-family', category: 'tourist_guide',
    title: 'Family-Friendly City Tour Guide', hindiTitle: 'परिवार के साथ शहर घूमने का गाइड',
    description: 'Plan a family-friendly city route with suitable stops and breaks. Entry tickets, food and transport are separate.',
    startingPrice: 799, durationMinutes: 180, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Custom route',
    included: ['Initial three-hour guided slot', 'Stops and pace agreed in advance', 'Tickets, meals and transport excluded']
  },
  {
    id: 'tour-guide-photo', category: 'tourist_guide',
    title: 'Photo Spots & Local Market Walk', hindiTitle: 'फोटो स्पॉट और लोकल मार्केट वॉक',
    description: 'Guided walk to local photo spots and markets. Shopping, photography fees and transport are paid separately.',
    startingPrice: 499, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Walking route',
    included: ['Initial two-hour walk', 'Route and meeting point confirmation', 'Shopping, entry fees and transport excluded']
  },
  {
    id: 'contractor-kitchen', category: 'contractor',
    title: 'Kitchen Renovation & Platform Estimate', hindiTitle: 'किचन रिनोवेशन और प्लेटफॉर्म अनुमान',
    description: 'Site assessment for kitchen platform, cabinets and renovation planning. Stone, fittings and execution are quoted separately.',
    startingPrice: 499, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Site measurement',
    included: ['Kitchen measurements and needs review', 'Basic work estimate discussion', 'Stone, cabinets, fittings and labour extra']
  },
  {
    id: 'contractor-roof-repair', category: 'contractor',
    title: 'Roof & Terrace Leakage Assessment', hindiTitle: 'छत और टेरेस लीकेज जांच',
    description: 'Inspect visible roof or terrace seepage and discuss repair options. Structural damage requires qualified engineering assessment.',
    startingPrice: 449, durationMinutes: 60, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Inspection first',
    included: ['Visible leakage and surface inspection', 'Repair approach estimate', 'Waterproofing materials and execution extra']
  },
  {
    id: 'contractor-door-window', category: 'contractor',
    title: 'Door, Window & Frame Repair Estimate', hindiTitle: 'दरवाजे, खिड़की और फ्रेम मरम्मत अनुमान',
    description: 'Assess damaged frames, plaster around openings and fitting issues. Carpentry, metal fabrication and replacement materials are separate.',
    startingPrice: 349, durationMinutes: 45, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Scope confirmed',
    included: ['Opening and frame inspection', 'Repair scope and estimate', 'Replacement frames, hardware and finishing extra']
  },
  {
    id: 'bike-rider-grocery', category: 'bike_rider',
    title: 'Grocery & Essentials Pickup', hindiTitle: 'किराना और जरूरी सामान पिकअप',
    description: 'Local pickup and delivery of permitted everyday essentials. Purchase amount, distance and waiting are confirmed separately.',
    startingPrice: 79, durationMinutes: 45, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Local pickup',
    included: ['One local shop pickup request', 'Item list and recipient confirmation', 'Purchase cost and waiting charged separately']
  },
  {
    id: 'bike-rider-food', category: 'bike_rider',
    title: 'Restaurant Order Pickup & Drop', hindiTitle: 'रेस्टोरेंट ऑर्डर पिकअप और डिलीवरी',
    description: 'Pickup of a prepaid or confirmed restaurant order and delivery to the customer. Food cost is paid to the restaurant.',
    startingPrice: 69, durationMinutes: 40, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Order confirmation',
    included: ['One restaurant pickup and drop', 'Order and recipient verification', 'Food bill, waiting and extra distance separate']
  },
  {
    id: 'bike-rider-medicine', category: 'bike_rider',
    title: 'Pharmacy Order Pickup', hindiTitle: 'मेडिकल स्टोर से ऑर्डर पिकअप',
    description: 'Pickup of a lawfully dispensed, properly documented pharmacy order. Prescription medicines require valid prescription and pharmacy approval.',
    startingPrice: 79, durationMinutes: 45, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Pharmacy rules apply',
    included: ['Sealed pharmacy order pickup', 'Recipient handover confirmation', 'Medicine cost and pharmacy requirements separate']
  },
  {
    id: 'labour-house-cleanup', category: 'labour',
    title: 'Household Deep Cleaning Helper', hindiTitle: 'घर की गहरी सफाई के लिए हेल्पर',
    description: 'General cleaning assistance for rooms, balconies and common areas. Specialist chemical treatment and equipment are extra.',
    startingPrice: 349, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Task list confirmed',
    included: ['One helper for initial two-hour slot', 'Rooms and tasks confirmed first', 'Cleaning chemicals and equipment extra']
  },
  {
    id: 'labour-construction-helper', category: 'labour',
    title: 'Construction Site General Helper', hindiTitle: 'निर्माण स्थल के लिए सामान्य हेल्पर',
    description: 'Non-specialist site assistance and material movement under site supervision. Skilled, hazardous and height work are excluded.',
    startingPrice: 399, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Site safety required',
    included: ['One helper for initial two-hour slot', 'Task and site safety confirmation', 'Tools, materials and extra hours separate']
  },
  {
    id: 'labour-shop-assistant', category: 'labour',
    title: 'Shop / Warehouse Stock Helper', hindiTitle: 'दुकान और गोदाम के लिए स्टॉक हेल्पर',
    description: 'General assistance for stock arrangement, packing and inventory movement. Heavy machinery and hazardous goods handling are excluded.',
    startingPrice: 349, durationMinutes: 120, rating: 0, reviewsCount: 0, warrantyDays: 0,
    badge: 'Work scope confirmed',
    included: ['One helper for initial two-hour slot', 'Stock and task details confirmed', 'Equipment and extra hours separate']
  },


];

export const INITIAL_TECHNICIANS: Technician[] = [
  {
    id: 'tech-101',
    name: 'Ramesh Kumar',
    phone: '+91 98450 12345',
    email: 'ramesh.electrician@quickfix.in',
    trades: ['electrician'],
    experienceYears: 8,
    city: 'Bengaluru',
    rating: 4.9,
    totalJobsCompleted: 582,
    avatar: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    isVerified: true,
    approvalStatus: 'approved',
    qualificationType: 'ITI Trade Certificate',
    qualificationRegNumber: 'ITI-KA-EL-2016-8812',
    qualificationInstitute: 'Govt ITI Industrial Training Institute, Bengaluru',
    walletBalance: 2850,
    securityDepositRequired: 2000,
    securityDepositPaid: true,
    withdrawableBalance: 850,
    lifetimeCashCollected: 2400,
    lifetimeCommissionPaid: 288,
    kycDocType: 'Skill India Certificate',
    kycDocNumber: 'SIC-EL-2018-9941',
    bankAccount: {
      accountNumber: '•••• •••• 4129',
      ifsc: 'SBIN0004128',
      upiId: 'ramesh.quickfix@okaxis'
    },
    todayEarnings: 1450,
    totalEarnings: 84200,
    pendingPayout: 1450
  },
  {
    id: 'tech-102',
    name: 'Rajesh Sharma',
    phone: '+91 97110 54321',
    email: 'rajesh.plumbing@quickfix.in',
    trades: ['plumber'],
    experienceYears: 11,
    city: 'Bengaluru',
    rating: 4.85,
    totalJobsCompleted: 740,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    isVerified: true,
    approvalStatus: 'approved',
    qualificationType: 'State Wireman/Plumber License',
    qualificationRegNumber: 'KA-PLUMB-LIC-2013-4091',
    qualificationInstitute: 'Karnataka State Directorate of Vocational Training',
    walletBalance: 3400,
    securityDepositRequired: 2000,
    securityDepositPaid: true,
    withdrawableBalance: 1400,
    lifetimeCashCollected: 3100,
    lifetimeCommissionPaid: 465,
    kycDocType: 'Aadhaar',
    kycDocNumber: '•••• •••• 7821',
    bankAccount: {
      accountNumber: '•••• •••• 9034',
      ifsc: 'HDFC0000123',
      upiId: 'rajesh.plumber@paytm'
    },
    todayEarnings: 1890,
    totalEarnings: 112000,
    pendingPayout: 1890
  },
  {
    id: 'tech-103',
    name: 'Suresh Varma',
    phone: '+91 98200 67890',
    email: 'suresh.multi@quickfix.in',
    trades: ['electrician', 'plumber'],
    experienceYears: 6,
    city: 'Mumbai',
    rating: 4.78,
    totalJobsCompleted: 310,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    isOnline: false,
    isVerified: true,
    approvalStatus: 'approved',
    qualificationType: 'Govt Polytechnic Diploma',
    qualificationRegNumber: 'MSBTE-DIP-EE-2018-771',
    qualificationInstitute: 'Maharashtra State Board of Technical Education',
    walletBalance: 2150,
    securityDepositRequired: 2000,
    securityDepositPaid: true,
    withdrawableBalance: 150,
    lifetimeCashCollected: 1800,
    lifetimeCommissionPaid: 216,
    kycDocType: 'PAN',
    kycDocNumber: 'ABCPS8120K',
    bankAccount: {
      accountNumber: '•••• •••• 6192',
      ifsc: 'ICIC0001092',
      upiId: 'suresh.varma@ybl'
    },
    todayEarnings: 0,
    totalEarnings: 45600,
    pendingPayout: 0
  },
  {
    id: 'tech-104',
    name: 'Mohammed Aslam',
    phone: '+91 91234 56789',
    email: 'aslam.plumb@quickfix.in',
    trades: ['plumber'],
    experienceYears: 4,
    city: 'Hyderabad',
    rating: 4.72,
    totalJobsCompleted: 140,
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    isOnline: false,
    isVerified: false, // Pending Trade Qualification & Security Deposit
    approvalStatus: 'pending_audit',
    qualificationType: 'Skill India / NSDC Certified',
    qualificationRegNumber: 'NSDC-PL-2022-81992',
    qualificationInstitute: 'National Skill Development Corporation (Plumbing Council)',
    walletBalance: 1500, // Below ₹2000 mandatory threshold -> Duty blocked
    securityDepositRequired: 2000,
    securityDepositPaid: false,
    withdrawableBalance: 0,
    lifetimeCashCollected: 0,
    lifetimeCommissionPaid: 0,
    kycDocType: 'Aadhaar',
    kycDocNumber: '•••• •••• 3349',
    bankAccount: {
      accountNumber: '•••• •••• 7711',
      ifsc: 'BARB0JUBILE',
      upiId: 'aslam.work@upi'
    },
    todayEarnings: 0,
    totalEarnings: 18200,
    pendingPayout: 0
  },
  {
    id: 'tech-105',
    name: 'Deepak Solanki',
    phone: '+91 98261 11223',
    email: 'deepak.solanki@quickfix.in',
    trades: ['electrician'],
    experienceYears: 7,
    city: 'Indore',
    rating: 4.92,
    totalJobsCompleted: 412,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    isVerified: true,
    approvalStatus: 'approved',
    qualificationType: 'ITI Trade Certificate',
    qualificationRegNumber: 'ITI-MP-IND-EL-2017-302',
    qualificationInstitute: 'Govt Model ITI Nanda Nagar, Indore',
    walletBalance: 2950,
    securityDepositRequired: 2000,
    securityDepositPaid: true,
    withdrawableBalance: 950,
    lifetimeCashCollected: 2100,
    lifetimeCommissionPaid: 252,
    kycDocType: 'Skill India Certificate',
    kycDocNumber: 'MP-IND-EL-2020-410',
    bankAccount: {
      accountNumber: '•••• •••• 5519',
      ifsc: 'SBIN0030114',
      upiId: 'deepak.solanki@okaxis'
    },
    todayEarnings: 1200,
    totalEarnings: 68400,
    pendingPayout: 1200
  },
  {
    id: 'tech-106',
    name: 'Kamlesh Rathore',
    phone: '+91 98272 33445',
    email: 'kamlesh.plumber@quickfix.in',
    trades: ['plumber'],
    experienceYears: 9,
    city: 'Bhopal',
    rating: 4.88,
    totalJobsCompleted: 530,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    isVerified: true,
    approvalStatus: 'approved',
    qualificationType: 'State Wireman/Plumber License',
    qualificationRegNumber: 'MP-BHO-PL-LIC-2015-883',
    qualificationInstitute: 'MP Directorate of Skill Development, Bhopal',
    walletBalance: 2600,
    securityDepositRequired: 2000,
    securityDepositPaid: true,
    withdrawableBalance: 600,
    lifetimeCashCollected: 1600,
    lifetimeCommissionPaid: 240,
    kycDocType: 'Aadhaar',
    kycDocNumber: '•••• •••• 9102',
    bankAccount: {
      accountNumber: '•••• •••• 8290',
      ifsc: 'PUNB0182900',
      upiId: 'kamlesh.rathore@paytm'
    },
    todayEarnings: 950,
    totalEarnings: 82000,
    pendingPayout: 950
  },
  {
    id: 'tech-107',
    name: 'Mohanlal Malviya',
    phone: '+91 94251 77889',
    email: 'mohan.malviya@quickfix.in',
    trades: ['electrician', 'plumber'],
    experienceYears: 10,
    city: 'Ujjain',
    rating: 4.95,
    totalJobsCompleted: 620,
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    isVerified: true,
    approvalStatus: 'approved',
    qualificationType: 'ITI Trade Certificate',
    qualificationRegNumber: 'ITI-MP-UJJ-EL-2014-551',
    qualificationInstitute: 'Madhav Science & Trade Institute, Ujjain',
    walletBalance: 3600,
    securityDepositRequired: 2000,
    securityDepositPaid: true,
    withdrawableBalance: 1600,
    lifetimeCashCollected: 2800,
    lifetimeCommissionPaid: 364,
    kycDocType: 'Skill India Certificate',
    kycDocNumber: 'MP-UJJ-EL-2019-105',
    bankAccount: {
      accountNumber: '•••• •••• 3381',
      ifsc: 'CBIN0280421',
      upiId: 'mohan.ujjain@upi'
    },
    todayEarnings: 1600,
    totalEarnings: 94500,
    pendingPayout: 1600
  },
  {
    id: 'tech-108',
    name: 'Govind Parmar',
    phone: '+91 99262 88123',
    email: 'govind.parmar@quickfix.in',
    trades: ['plumber'],
    experienceYears: 6,
    city: 'Dewas',
    rating: 4.81,
    totalJobsCompleted: 290,
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    isVerified: true,
    approvalStatus: 'approved',
    qualificationType: 'Skill India / NSDC Certified',
    qualificationRegNumber: 'NSDC-PL-MP-2018-9128',
    qualificationInstitute: 'Dewas Skill Training Academy & Govt Polytechnic',
    walletBalance: 2450,
    securityDepositRequired: 2000,
    securityDepositPaid: true,
    withdrawableBalance: 450,
    lifetimeCashCollected: 1400,
    lifetimeCommissionPaid: 210,
    kycDocType: 'Aadhaar',
    kycDocNumber: '•••• •••• 4421',
    bankAccount: {
      accountNumber: '•••• •••• 9920',
      ifsc: 'BOI0008819',
      upiId: 'govind.dewas@ybl'
    },
    todayEarnings: 750,
    totalEarnings: 39800,
    pendingPayout: 750
  },
  {
    id: 'tech-109',
    name: 'Vikas Chordia (AC & Fridge Specialist)',
    phone: '+91 98263 99011',
    email: 'vikas.hvac@quickfix.in',
    trades: ['ac_repair', 'fridge_repair'],
    experienceYears: 8,
    city: 'Indore',
    rating: 4.94,
    totalJobsCompleted: 480,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    isVerified: true,
    approvalStatus: 'approved',
    qualificationType: 'Govt Polytechnic Diploma',
    qualificationRegNumber: 'RAC-DIP-MP-2016-902',
    qualificationInstitute: 'Indore Institute of Refrigeration & AC Technology',
    walletBalance: 3200,
    securityDepositRequired: 2000,
    securityDepositPaid: true,
    withdrawableBalance: 1200,
    lifetimeCashCollected: 3400,
    lifetimeCommissionPaid: 510,
    kycDocType: 'Skill India Certificate',
    kycDocNumber: 'SIC-RAC-2018-4412',
    bankAccount: {
      accountNumber: '•••• •••• 8812',
      ifsc: 'HDFC0001820',
      upiId: 'vikas.chordia@okaxis'
    },
    todayEarnings: 1850,
    totalEarnings: 98000,
    pendingPayout: 1850
  }
];

export const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'QF-7049',
    serviceId: 'elec-fan',
    serviceTitle: 'Ceiling Fan Repair & Installation',
    category: 'electrician',
    customerName: 'Ananya Deshmukh',
    customerPhone: '+91 98451 99221',
    customerAddress: 'Flat 402, Sai Silver Woods, 5th Cross, Koramangala 4th Block',
    city: 'Bengaluru',
    pincode: '560034',
    scheduledDate: 'Today',
    scheduledTimeSlot: 'Within 45 Mins (Express)',
    notes: 'Master bedroom fan is producing a squeaking grinding sound and moving sluggishly on regulator 5.',
    status: 'technician_en_route',
    technicianId: 'tech-101',
    technicianName: 'Ramesh Kumar',
    technicianPhone: '+91 98450 12345',
    technicianRating: 4.9,
    technicianEtaMinutes: 14,
    technicianCurrentLocation: { lat: 12.9352, lng: 77.6245 },
    startOtp: '4821',
    price: 199,
    visitingCharges: 49,
    discount: 30,
    taxes: 39,
    totalAmount: 257,
    commissionRate: 12, // 12%
    adminCommission: 31,
    technicianPayout: 226,
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    transactionRef: 'UPI/630188921102',
    acceptedAt: '2026-11-03T08:46:00Z',
    serviceDeadline: '2026-11-03T09:46:00Z',
    acceptanceCommissionDebited: true,
    acceptanceCommissionAmount: 31,
    paidAt: '2026-11-03T08:47:15Z',
    createdAt: '2026-11-03T08:45:00Z'
  },
  {
    id: 'QF-6982',
    serviceId: 'plumb-tap',
    serviceTitle: 'Tap, Faucet & Mixer Repair',
    category: 'plumber',
    customerName: 'Vikramaditya Rao',
    customerPhone: '+91 99160 33445',
    customerAddress: 'Villa 12, Green Glen Layout, Bellandur',
    city: 'Bengaluru',
    pincode: '560103',
    scheduledDate: 'Yesterday',
    scheduledTimeSlot: '02:00 PM - 04:00 PM',
    notes: 'Kitchen sink high-arc mixer tap leaking steadily from swivel collar.',
    status: 'completed',
    technicianId: 'tech-102',
    technicianName: 'Rajesh Sharma',
    technicianPhone: '+91 97110 54321',
    technicianRating: 4.85,
    startOtp: '8910',
    price: 199,
    visitingCharges: 49,
    discount: 0,
    taxes: 45,
    totalAmount: 293,
    commissionRate: 15, // 15%
    adminCommission: 44,
    technicianPayout: 249,
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    transactionRef: 'UPI/630287114920',
    paidAt: '2026-11-02T13:12:00Z',
    createdAt: '2026-11-02T13:10:00Z',
    review: {
      rating: 5,
      comment: 'Arrived within 25 minutes! Replaced the faulty ceramic spindle cleanly with zero water leakage now. Very courteous professional.',
      tags: ['Punctual', 'Clean Work', 'Honest Pricing'],
      createdAt: '2026-11-02T15:40:00Z'
    }
  },
  {
    id: 'QF-6811',
    serviceId: 'elec-mcb',
    serviceTitle: 'MCB Tripping & Short Circuit Fix',
    category: 'electrician',
    customerName: 'Pooja Hegde',
    customerPhone: '+91 98860 11223',
    customerAddress: 'House #84, 12th Main, Indiranagar',
    city: 'Bengaluru',
    pincode: '560038',
    scheduledDate: '2 Nov 2026',
    scheduledTimeSlot: '11:00 AM - 01:00 PM',
    notes: 'Main trip switch falling down when geyser and microwave operate at same time.',
    status: 'completed',
    technicianId: 'tech-101',
    technicianName: 'Ramesh Kumar',
    technicianPhone: '+91 98450 12345',
    technicianRating: 4.9,
    startOtp: '2356',
    price: 349,
    visitingCharges: 49,
    discount: 50,
    taxes: 63,
    totalAmount: 411,
    commissionRate: 12,
    adminCommission: 49,
    technicianPayout: 362,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    transactionRef: 'CASH/BLR-4891',
    paidAt: '2026-11-02T12:05:00Z',
    createdAt: '2026-11-02T10:15:00Z',
    review: {
      rating: 5,
      comment: 'Detected a dangerous loose neutral wire in the DB box that could have burnt the wiring. Fixed with a 32A C-curve MCB.',
      tags: ['Safety First', 'Expert Diagnostics', 'Proper Tools'],
      createdAt: '2026-11-02T12:20:00Z',
      adminReply: 'Thank you Pooja! Safety is our top priority. The 30-day warranty is logged in your dashboard.'
    }
  },
  {
    id: 'QF-6790',
    serviceId: 'plumb-toilet',
    serviceTitle: 'Toilet Cistern & Flush Valve Fix',
    category: 'plumber',
    customerName: 'Rohan Kulkarni',
    customerPhone: '+91 98210 77654',
    customerAddress: 'A-204, Oberoi Springs, Andheri West',
    city: 'Mumbai',
    pincode: '400053',
    scheduledDate: 'Today',
    scheduledTimeSlot: '04:00 PM - 06:00 PM',
    notes: 'Dual flush button stuck inside and cistern water continuously overflowing into bowl.',
    status: 'requested',
    startOtp: '5192',
    price: 299,
    visitingCharges: 29,
    discount: 20,
    taxes: 55,
    totalAmount: 363,
    commissionRate: 15,
    adminCommission: 74,
    technicianPayout: 289,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    transactionRef: 'COD/MUM-PENDING-71',
    createdAt: '2026-11-03T11:20:00Z'
  },
  {
    id: 'QF-6734',
    serviceId: 'elec-light',
    serviceTitle: 'LED Chandelier & False Ceiling Lighting',
    category: 'electrician',
    customerName: 'Kavita Sundaram',
    customerPhone: '+91 98401 77319',
    customerAddress: 'Tower 4, 902, L&T Eden Park, Siruseri',
    city: 'Chennai',
    pincode: '603103',
    scheduledDate: 'Today',
    scheduledTimeSlot: '12:00 PM - 02:00 PM',
    notes: 'Wiring loose contact on warm-white COB downlights in drawing room.',
    status: 'requested',
    startOtp: '6741',
    price: 399,
    visitingCharges: 49,
    discount: 0,
    taxes: 80,
    totalAmount: 528,
    commissionRate: 12,
    adminCommission: 63,
    technicianPayout: 465,
    paymentMethod: 'upi',
    paymentStatus: 'failed',
    transactionRef: 'UPI/FAIL/551980',
    createdAt: '2026-11-03T09:15:00Z'
  },
  {
    id: 'QF-6650',
    serviceId: 'elec-inverter',
    serviceTitle: 'Inverter & Battery Wiring Setup',
    category: 'electrician',
    customerName: 'Meera Nambiar',
    customerPhone: '+91 97410 88990',
    customerAddress: 'Plot 31, Road No 10, Jubilee Hills',
    city: 'Hyderabad',
    pincode: '500033',
    scheduledDate: '31 Oct 2026',
    scheduledTimeSlot: '10:00 AM - 12:00 PM',
    notes: 'Exide 150Ah tubular battery setup with Microtek sine wave inverter.',
    status: 'completed',
    technicianId: 'tech-103',
    technicianName: 'Suresh Varma',
    technicianPhone: '+91 98200 67890',
    technicianRating: 4.78,
    startOtp: '7412',
    price: 499,
    visitingCharges: 29,
    discount: 0,
    taxes: 95,
    totalAmount: 623,
    commissionRate: 12,
    adminCommission: 89,
    technicianPayout: 534,
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    transactionRef: 'UPI/629011984210',
    paidAt: '2026-10-31T09:05:00Z',
    createdAt: '2026-10-31T09:00:00Z',
    review: {
      rating: 4,
      comment: 'Solid installation and neat crimped wiring. Arrived slightly late due to rain, but work quality was top notch.',
      tags: ['Neat Wiring', 'Good Explanation'],
      createdAt: '2026-10-31T12:45:00Z'
    }
  },
  {
    id: 'QF-6520',
    serviceId: 'plumb-block',
    serviceTitle: 'Drain & Kitchen Sink Unclogging',
    category: 'plumber',
    customerName: 'Deepak Singhal',
    customerPhone: '+91 98112 44321',
    customerAddress: 'E-42, Greater Kailash 2',
    city: 'Delhi NCR',
    pincode: '110048',
    scheduledDate: '28 Oct 2026',
    scheduledTimeSlot: '03:00 PM - 05:00 PM',
    notes: 'Main kitchen drain backup during dishwasher cycle.',
    status: 'completed',
    technicianId: 'tech-102',
    technicianName: 'Rajesh Sharma',
    technicianPhone: '+91 97110 54321',
    technicianRating: 4.85,
    startOtp: '3391',
    price: 349,
    visitingCharges: 49,
    discount: 20,
    taxes: 68,
    totalAmount: 446,
    commissionRate: 15,
    adminCommission: 67,
    technicianPayout: 379,
    paymentMethod: 'card',
    paymentStatus: 'paid',
    transactionRef: 'PG/HDFC/883190',
    paidAt: '2026-10-28T14:40:00Z',
    createdAt: '2026-10-28T14:35:00Z'
  },
  {
    id: 'QF-6410',
    serviceId: 'elec-appliance',
    serviceTitle: 'Geyser & Water Heater Electrical Check',
    category: 'electrician',
    customerName: 'Sunita Reddy',
    customerPhone: '+91 99080 66554',
    customerAddress: 'Flat 10B, My Home Bhooja, HITEC City',
    city: 'Hyderabad',
    pincode: '500081',
    scheduledDate: '15 Oct 2026',
    scheduledTimeSlot: '09:00 AM - 11:00 AM',
    notes: 'Thermostat indicator light flickers and heating coil makes whistling noise.',
    status: 'completed',
    technicianId: 'tech-103',
    technicianName: 'Suresh Varma',
    technicianPhone: '+91 98200 67890',
    technicianRating: 4.78,
    startOtp: '8102',
    price: 299,
    visitingCharges: 29,
    discount: 0,
    taxes: 59,
    totalAmount: 387,
    commissionRate: 12,
    adminCommission: 46,
    technicianPayout: 341,
    paymentMethod: 'netbanking',
    paymentStatus: 'paid',
    transactionRef: 'NB/ICICI/119820',
    paidAt: '2026-10-15T09:12:00Z',
    createdAt: '2026-10-15T09:05:00Z'
  },
  {
    id: 'QF-6305',
    serviceId: 'plumb-leak',
    serviceTitle: 'Concealed Pipe Leakage Detection',
    category: 'plumber',
    customerName: 'Anil Agrawal',
    customerPhone: '+91 98260 55443',
    customerAddress: 'B-14, Arera Colony',
    city: 'Bhopal',
    pincode: '462016',
    scheduledDate: '10 Oct 2026',
    scheduledTimeSlot: '01:00 PM - 03:00 PM',
    notes: 'Dampness patch spreading on common wall between bathroom and bedroom.',
    status: 'completed',
    technicianId: 'tech-104',
    technicianName: 'Mohammed Aslam',
    technicianPhone: '+91 91234 56789',
    technicianRating: 4.72,
    startOtp: '9045',
    price: 599,
    visitingCharges: 49,
    discount: 50,
    taxes: 107,
    totalAmount: 705,
    commissionRate: 15,
    adminCommission: 106,
    technicianPayout: 599,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    transactionRef: 'COD/BHP-PENDING-44',
    createdAt: '2026-10-10T11:00:00Z'
  },
  {
    id: 'QF-7101',
    serviceId: 'elec-fan',
    serviceTitle: 'Ceiling Fan Heavy Wiring & Speed Regulator Fix',
    category: 'electrician',
    customerName: 'Rohit Patidar',
    customerPhone: '+91 98260 41234',
    customerAddress: '102, Shrivardhan Complex, RNT Marg',
    city: 'Indore',
    pincode: '452001',
    scheduledDate: 'Today',
    scheduledTimeSlot: 'Within 45 Mins (Express)',
    notes: 'Living room copper coil fan humming and regulator stuck on high speed.',
    status: 'technician_en_route',
    technicianId: 'tech-105',
    technicianName: 'Deepak Solanki',
    technicianPhone: '+91 98261 11223',
    technicianRating: 4.92,
    technicianEtaMinutes: 12,
    technicianCurrentLocation: { lat: 22.7196, lng: 75.8577 },
    startOtp: '5190',
    price: 249,
    visitingCharges: 29,
    discount: 20,
    taxes: 46,
    totalAmount: 304,
    commissionRate: 12,
    adminCommission: 59,
    technicianPayout: 245,
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    transactionRef: 'UPI/IND-778912304',
    paidAt: '2026-11-04T07:10:00Z',
    createdAt: '2026-11-04T07:05:00Z'
  },
  {
    id: 'QF-7102',
    serviceId: 'plumb-leak',
    serviceTitle: 'Overhead Tank Float Valve & Pipe Leakage',
    category: 'plumber',
    customerName: 'Priya Sharma',
    customerPhone: '+91 98270 55432',
    customerAddress: 'E-3/42, Arera Colony, Near 10 No. Market',
    city: 'Bhopal',
    pincode: '462016',
    scheduledDate: 'Today',
    scheduledTimeSlot: '11:00 AM - 01:00 PM',
    notes: 'Rooftop water tank continuous overflow and pipe elbow dripping.',
    status: 'assigned',
    technicianId: 'tech-106',
    technicianName: 'Kamlesh Rathore',
    technicianPhone: '+91 98272 33445',
    technicianRating: 4.88,
    technicianEtaMinutes: 25,
    startOtp: '7231',
    price: 399,
    visitingCharges: 29,
    discount: 0,
    taxes: 77,
    totalAmount: 505,
    commissionRate: 15,
    adminCommission: 89,
    technicianPayout: 416,
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    transactionRef: 'UPI/BHP-990145210',
    paidAt: '2026-11-04T06:40:00Z',
    createdAt: '2026-11-04T06:30:00Z'
  },
  {
    id: 'QF-7103',
    serviceId: 'elec-mcb',
    serviceTitle: 'Main Line MCB & Power Sockets Repair',
    category: 'electrician',
    customerName: 'Shivam Joshi',
    customerPhone: '+91 94250 88219',
    customerAddress: '45, Freeganj Main Road, Near Tower Chowk',
    city: 'Ujjain',
    pincode: '456010',
    scheduledDate: 'Yesterday',
    scheduledTimeSlot: '02:00 PM - 04:00 PM',
    notes: 'Main double-pole MCB sparking upon turning on geyser.',
    status: 'completed',
    technicianId: 'tech-107',
    technicianName: 'Mohanlal Malviya',
    technicianPhone: '+91 94251 77889',
    technicianRating: 4.95,
    startOtp: '4482',
    price: 349,
    visitingCharges: 29,
    discount: 30,
    taxes: 62,
    totalAmount: 410,
    commissionRate: 12,
    adminCommission: 71,
    technicianPayout: 339,
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    transactionRef: 'UPI/UJJ-31849021',
    paidAt: '2026-11-03T14:45:00Z',
    createdAt: '2026-11-03T13:40:00Z',
    review: {
      rating: 5,
      comment: 'Super fast arrival in Freeganj! Replaced the burnt Schneider MCB with genuine new unit and tested load.',
      tags: ['Quick Arrival', 'Expert Electrician', 'Original Parts'],
      createdAt: '2026-11-03T15:10:00Z'
    }
  },
  {
    id: 'QF-7104',
    serviceId: 'plumb-tap',
    serviceTitle: 'Kitchen Mixer Tap & Submersible Line Fix',
    category: 'plumber',
    customerName: 'Ankit Verma',
    customerPhone: '+91 99260 33100',
    customerAddress: '12, Chamunda Complex, AB Road',
    city: 'Dewas',
    pincode: '455001',
    scheduledDate: 'Yesterday',
    scheduledTimeSlot: '04:00 PM - 06:00 PM',
    notes: 'Water pressure low from overhead line and kitchen quarter-turn tap loose.',
    status: 'completed',
    technicianId: 'tech-108',
    technicianName: 'Govind Parmar',
    technicianPhone: '+91 99262 88123',
    technicianRating: 4.81,
    startOtp: '6614',
    price: 299,
    visitingCharges: 29,
    discount: 0,
    taxes: 59,
    totalAmount: 387,
    commissionRate: 15,
    adminCommission: 74,
    technicianPayout: 313,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    transactionRef: 'CASH/DWS-8812',
    paidAt: '2026-11-03T17:15:00Z',
    createdAt: '2026-11-03T16:00:00Z',
    review: {
      rating: 5,
      comment: 'Very polite plumber from Dewas. Cleaned the aerator filter and replaced washer in 20 minutes.',
      tags: ['Affordable', 'Fast Service'],
      createdAt: '2026-11-03T17:30:00Z'
    }
  },


];

export const INITIAL_COMMISSION_SETTINGS: CommissionSettings = {
  electricianCommissionPct: 12,
  plumberCommissionPct: 15,
  acCommissionPct: 15,
  fridgeCommissionPct: 15,
  minSecurityDeposit: 2000,
  platformConvenienceFee: 29,
  gstPct: 18,
  minPayoutThreshold: 500
};

export const INITIAL_ADMIN_PAYMENT_CONFIG: AdminMasterPaymentConfig = {
  merchantName: 'QuickFix Technologies India Pvt Ltd (HQ Master Account)',
  merchantVpa: 'quickfix.master@hdfcbank',
  bankName: 'HDFC Bank Ltd',
  bankAccountNumber: '50200088192831',
  bankIfsc: 'HDFC0000128',
  gatewayProvider: 'Razorpay Escrow & Cashfree Payouts API',
  merchantId: 'MID_QF_MASTER_9921',
  escrowEnabled: true,
  manualApprovalRequired: true,
  payoutSchedule: 'instant_on_admin_approval',
  tdsDeductionPct: 1.0
};

export const INITIAL_PAYOUTS: PayoutRecord[] = [
  {
    id: 'PAY-901',
    technicianId: 'tech-101',
    technicianName: 'Ramesh Kumar',
    amount: 4200,
    upiId: 'ramesh.quickfix@okaxis',
    status: 'settled',
    adminApprovalStatus: 'approved_and_released',
    adminApprovedBy: 'HQ Admin Operations',
    requestedAt: '2026-11-01T18:00:00Z',
    settledAt: '2026-11-01T18:05:12Z',
    referenceNumber: 'UPI/630198129043'
  },
  {
    id: 'PAY-902',
    technicianId: 'tech-102',
    technicianName: 'Rajesh Sharma',
    amount: 5800,
    upiId: 'rajesh.plumber@paytm',
    status: 'settled',
    adminApprovalStatus: 'approved_and_released',
    adminApprovedBy: 'HQ Admin Operations',
    requestedAt: '2026-11-02T19:30:00Z',
    settledAt: '2026-11-02T19:32:45Z',
    referenceNumber: 'UPI/630287114920'
  },
  {
    id: 'PAY-903',
    technicianId: 'tech-105',
    technicianName: 'Deepak Solanki (Indore)',
    amount: 1200,
    upiId: 'deepak.solanki@okaxis',
    status: 'processing',
    adminApprovalStatus: 'pending_approval',
    adminNote: 'Awaiting Admin 1-Click Release from HDFC Master Account',
    requestedAt: '2026-11-04T06:30:00Z',
    referenceNumber: 'ESCROW/IND-903'
  },
  {
    id: 'PAY-904',
    technicianId: 'tech-106',
    technicianName: 'Kamlesh Rathore (Bhopal)',
    amount: 950,
    upiId: 'kamlesh.rathore@paytm',
    status: 'processing',
    adminApprovalStatus: 'pending_approval',
    adminNote: 'Job QF-7102 verified by customer; ready for Admin disburse',
    requestedAt: '2026-11-04T06:45:00Z',
    referenceNumber: 'ESCROW/BHP-904'
  },
  {
    id: 'PAY-905',
    technicianId: 'tech-107',
    technicianName: 'Mohanlal Malviya (Ujjain)',
    amount: 1600,
    upiId: 'mohan.ujjain@upi',
    status: 'processing',
    adminApprovalStatus: 'pending_approval',
    adminNote: 'Rating 5.0 received; pending Admin settlement',
    requestedAt: '2026-11-04T06:50:00Z',
    referenceNumber: 'ESCROW/UJJ-905'
  },
  {
    id: 'PAY-906',
    technicianId: 'tech-108',
    technicianName: 'Govind Parmar (Dewas)',
    amount: 750,
    upiId: 'govind.dewas@ybl',
    status: 'on_hold',
    adminApprovalStatus: 'held_by_admin',
    adminNote: 'Audit Hold: Customer requested verification of parts bill',
    requestedAt: '2026-11-03T18:00:00Z',
    referenceNumber: 'ESCROW/DWS-906'
  }
];

export const INITIAL_WALLET_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'TXN-W101',
    technicianId: 'tech-101',
    type: 'security_deposit',
    amount: 2000,
    balanceAfter: 2000,
    description: 'Mandatory Partner Security Deposit (Non-withdrawable)',
    timestamp: '2026-10-15T09:00:00Z'
  },
  {
    id: 'TXN-W102',
    technicianId: 'tech-101',
    type: 'online_payout_credit',
    amount: 1138,
    balanceAfter: 3138,
    bookingId: 'QF-7049',
    description: 'Online Job Net Payout credited for #QF-7049',
    timestamp: '2026-11-03T10:30:00Z'
  },
  {
    id: 'TXN-W103',
    technicianId: 'tech-101',
    type: 'cash_commission_deduction',
    amount: 288,
    balanceAfter: 2850,
    bookingId: 'QF-7052',
    description: 'Auto-commission deduction for Cash Job (Customer paid ₹2,400 cash)',
    timestamp: '2026-11-03T13:45:00Z'
  },
  {
    id: 'TXN-W104',
    technicianId: 'tech-102',
    type: 'security_deposit',
    amount: 2000,
    balanceAfter: 2000,
    description: 'Mandatory Partner Security Deposit (Non-withdrawable)',
    timestamp: '2026-10-18T11:00:00Z'
  },
  {
    id: 'TXN-W105',
    technicianId: 'tech-102',
    type: 'topup',
    amount: 1400,
    balanceAfter: 3400,
    description: 'Technician Wallet Top-up via UPI (Fast Transfer)',
    timestamp: '2026-11-01T14:20:00Z'
  },
  {
    id: 'TXN-W106',
    technicianId: 'tech-109',
    type: 'security_deposit',
    amount: 2000,
    balanceAfter: 2000,
    description: 'Mandatory Partner Security Deposit (Non-withdrawable)',
    timestamp: '2026-10-20T10:00:00Z'
  },
  {
    id: 'TXN-W107',
    technicianId: 'tech-109',
    type: 'topup',
    amount: 1200,
    balanceAfter: 3200,
    description: 'Technician Wallet Top-up via PhonePe/GPay',
    timestamp: '2026-11-02T16:15:00Z'
  }
];

export const INITIAL_CUSTOMERS: CustomerUser[] = [
  {
    id: 'cust-501',
    name: 'Ananya Deshmukh',
    phone: '+91 98451 99221',
    email: 'ananya.deshmukh@gmail.com',
    status: 'active',
    totalBookings: 4,
    totalSpent: 1240,
    addresses: [
      {
        id: 'addr-1',
        label: 'Home',
        addressLine: 'Flat 402, Sai Silver Woods, 5th Cross, Koramangala 4th Block',
        city: 'Bengaluru',
        pincode: '560034'
      },
      {
        id: 'addr-2',
        label: 'Work',
        addressLine: 'WeWork Galaxy, 43 Residency Road, Shanthala Nagar',
        city: 'Bengaluru',
        pincode: '560025'
      }
    ]
  },
  {
    id: 'cust-502',
    name: 'Vikramaditya Rao',
    phone: '+91 99160 33445',
    email: 'vikram.rao@techcorp.in',
    status: 'active',
    totalBookings: 6,
    totalSpent: 2150,
    addresses: [
      {
        id: 'addr-3',
        label: 'Home',
        addressLine: 'Villa 12, Green Glen Layout, Bellandur',
        city: 'Bengaluru',
        pincode: '560103'
      }
    ]
  },
  {
    id: 'cust-503',
    name: 'Pooja Hegde',
    phone: '+91 98860 11223',
    email: 'pooja.hegde@designstudio.co',
    status: 'active',
    totalBookings: 2,
    totalSpent: 760,
    addresses: [
      {
        id: 'addr-4',
        label: 'Home',
        addressLine: 'House #84, 12th Main, Indiranagar',
        city: 'Bengaluru',
        pincode: '560038'
      }
    ]
  },
  {
    id: 'cust-504',
    name: 'Rohan Kulkarni',
    phone: '+91 98210 77654',
    email: 'rohan.kulkarni@gmail.com',
    status: 'active',
    totalBookings: 3,
    totalSpent: 990,
    addresses: [
      {
        id: 'addr-5',
        label: 'Home',
        addressLine: 'A-204, Oberoi Springs, Andheri West',
        city: 'Mumbai',
        pincode: '400053'
      }
    ]
  },
  {
    id: 'cust-505',
    name: 'Meera Nambiar',
    phone: '+91 97410 88990',
    email: 'meera.nambiar@outlook.com',
    status: 'active',
    totalBookings: 1,
    totalSpent: 350,
    addresses: [
      {
        id: 'addr-6',
        label: 'Home',
        addressLine: 'Plot 31, Road No 10, Jubilee Hills',
        city: 'Hyderabad',
        pincode: '500033'
      }
    ]
  },
  {
    id: 'cust-506',
    name: 'Rohit Patidar',
    phone: '+91 98260 41234',
    email: 'rohit.patidar@gmail.com',
    status: 'active',
    totalBookings: 4,
    totalSpent: 1250,
    addresses: [
      {
        id: 'addr-7',
        label: 'Home',
        addressLine: '102, Shrivardhan Complex, RNT Marg',
        city: 'Indore',
        pincode: '452001'
      },
      {
        id: 'addr-7b',
        label: 'Work',
        addressLine: 'Scheme 54, Vijay Nagar, Near Orbit Mall',
        city: 'Indore',
        pincode: '452010'
      }
    ]
  },
  {
    id: 'cust-507',
    name: 'Priya Sharma',
    phone: '+91 98270 55432',
    email: 'priya.sharma@bhopal.in',
    status: 'active',
    totalBookings: 3,
    totalSpent: 1420,
    addresses: [
      {
        id: 'addr-8',
        label: 'Home',
        addressLine: 'E-3/42, Arera Colony, Near 10 No. Market',
        city: 'Bhopal',
        pincode: '462016'
      }
    ]
  },
  {
    id: 'cust-508',
    name: 'Shivam Joshi',
    phone: '+91 94250 88219',
    email: 'shivam.joshi@ujjain.in',
    status: 'active',
    totalBookings: 5,
    totalSpent: 1890,
    addresses: [
      {
        id: 'addr-9',
        label: 'Home',
        addressLine: '45, Freeganj Main Road, Near Tower Chowk',
        city: 'Ujjain',
        pincode: '456010'
      }
    ]
  },
  {
    id: 'cust-509',
    name: 'Ankit Verma',
    phone: '+91 99260 33100',
    email: 'ankit.verma@dewas.in',
    status: 'active',
    totalBookings: 2,
    totalSpent: 740,
    addresses: [
      {
        id: 'addr-10',
        label: 'Home',
        addressLine: '12, Chamunda Complex, AB Road',
        city: 'Dewas',
        pincode: '455001'
      }
    ]
  }
];

export const CURRENT_CUSTOMER: CustomerUser = INITIAL_CUSTOMERS[0];

export const INDIAN_CITIES = [
  'Indore',
  'Bhopal',
  'Dewas',
  'Ujjain',
  'Bengaluru',
  'Mumbai',
  'Delhi-NCR',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Kolkata',
  'Ahmedabad'
];
