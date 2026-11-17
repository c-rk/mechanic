/** The vehicle specification sheet: categories, fields and how each value was obtained. */

export type SpecSource = 'vin' | 'ai' | 'user';

export interface SpecValue {
  value: string;
  source: SpecSource;
}

export type SpecSheet = Record<string, SpecValue>;

export interface SpecField {
  key: string;
  label: string;
  /** Guidance for the AI and placeholder for manual entry. */
  hint: string;
}

export interface SpecCategory {
  id: string;
  title: string;
  icon: string;
  fields: SpecField[];
}

const f = (key: string, label: string, hint: string): SpecField => ({ key, label, hint });

export const SPEC_CATEGORIES: SpecCategory[] = [
  {
    id: 'engine',
    title: 'Engine & performance',
    icon: 'engine-outline',
    fields: [
      f('engineCode', 'Engine code', 'manufacturer engine code, e.g. R18A1'),
      f('displacement', 'Displacement', 'e.g. 1,798 cc (1.8 L)'),
      f('cylinders', 'Cylinders & layout', 'e.g. 4, inline'),
      f('valvetrain', 'Valvetrain', 'e.g. SOHC 16-valve, i-VTEC'),
      f('aspiration', 'Aspiration', 'naturally aspirated / turbocharged / supercharged'),
      f('fuelSystem', 'Fuel system', 'e.g. multi-point injection, direct injection'),
      f('power', 'Max power', 'e.g. 104 kW (140 hp) @ 6,300 rpm'),
      f('torque', 'Max torque', 'e.g. 174 Nm @ 4,300 rpm'),
      f('compression', 'Compression ratio', 'e.g. 10.6:1'),
      f('boreStroke', 'Bore × stroke', 'e.g. 81.0 × 87.3 mm'),
      f('topSpeed', 'Top speed', 'e.g. 200 km/h (124 mph)'),
      f('accel', '0–100 km/h', 'e.g. 9.1 s'),
      f('redline', 'Redline', 'e.g. 6,800 rpm'),
    ],
  },
  {
    id: 'drivetrain',
    title: 'Transmission & drivetrain',
    icon: 'cog-transfer-outline',
    fields: [
      f('transmission', 'Transmission', 'e.g. 5-speed automatic'),
      f('gears', 'Gear ratios', 'e.g. 1st 2.67, 2nd 1.53 …, final drive 4.44'),
      f('drive', 'Driven wheels', 'FWD / RWD / AWD / 4WD'),
      f('clutch', 'Clutch / torque converter', 'e.g. single dry plate 215 mm'),
    ],
  },
  {
    id: 'fuel',
    title: 'Fuel & efficiency',
    icon: 'gas-station-outline',
    fields: [
      f('fuelType', 'Fuel', 'e.g. petrol, RON 91 minimum'),
      f('tank', 'Fuel tank', 'e.g. 50 L'),
      f('consumptionCity', 'Consumption, city', 'e.g. 8.9 L/100 km'),
      f('consumptionHighway', 'Consumption, highway', 'e.g. 5.9 L/100 km'),
      f('consumptionCombined', 'Consumption, combined', 'e.g. 7.0 L/100 km'),
      f('co2', 'CO₂ emissions', 'e.g. 165 g/km'),
      f('emissions', 'Emissions standard', 'e.g. Euro 5, Tier 2 Bin 5'),
      f('battery', 'Traction battery', 'EV/hybrid only, e.g. 64 kWh usable'),
      f('evRange', 'Electric range', 'EV/hybrid only'),
    ],
  },
  {
    id: 'dimensions',
    title: 'Exterior dimensions',
    icon: 'ruler',
    fields: [
      f('length', 'Length', 'e.g. 4,540 mm'),
      f('width', 'Width (excl. mirrors)', 'e.g. 1,750 mm'),
      f('widthMirrors', 'Width (incl. mirrors)', 'e.g. 1,960 mm'),
      f('height', 'Height', 'e.g. 1,435 mm'),
      f('wheelbase', 'Wheelbase', 'e.g. 2,700 mm'),
      f('trackFront', 'Track, front', 'e.g. 1,500 mm'),
      f('trackRear', 'Track, rear', 'e.g. 1,520 mm'),
      f('overhangFront', 'Overhang, front', 'mm'),
      f('overhangRear', 'Overhang, rear', 'mm'),
      f('groundClearance', 'Ground clearance', 'e.g. 150 mm'),
      f('turningCircle', 'Turning circle', 'e.g. 10.8 m'),
      f('dragCoefficient', 'Drag coefficient', 'e.g. Cd 0.31'),
    ],
  },
  {
    id: 'weights',
    title: 'Weights & towing',
    icon: 'weight-kilogram',
    fields: [
      f('kerbWeight', 'Kerb weight', 'e.g. 1,240 kg'),
      f('gvw', 'Gross vehicle weight', 'e.g. 1,700 kg'),
      f('payload', 'Payload', 'kg'),
      f('towBraked', 'Towing, braked', 'kg'),
      f('towUnbraked', 'Towing, unbraked', 'kg'),
      f('roofLoad', 'Roof load', 'kg'),
      f('weightDistribution', 'Weight distribution', 'front/rear %'),
    ],
  },
  {
    id: 'interior',
    title: 'Interior & boot',
    icon: 'car-seat',
    fields: [
      f('seats', 'Seats', 'e.g. 5'),
      f('doors', 'Doors', 'e.g. 4'),
      f('bootVolume', 'Boot volume (seats up)', 'e.g. 340 L'),
      f('bootVolumeMax', 'Boot volume (seats folded)', 'L'),
      f('bootLength', 'Boot floor length', 'mm'),
      f('bootWidth', 'Boot width (between arches)', 'mm'),
      f('bootHeight', 'Boot opening height', 'mm'),
      f('loadLip', 'Load lip height', 'mm from ground'),
    ],
  },
  {
    id: 'wheels',
    title: 'Wheels & tyres',
    icon: 'tire',
    fields: [
      f('tyresFront', 'Tyre size, front', 'e.g. 205/55 R16 91V'),
      f('tyresRear', 'Tyre size, rear', 'e.g. 205/55 R16 91V'),
      f('rimFront', 'Rim, front', 'diameter × width and offset, e.g. 16 × 6.5J ET45'),
      f('rimRear', 'Rim, rear', 'e.g. 16 × 6.5J ET45'),
      f('boltPattern', 'Bolt pattern (PCD)', 'e.g. 5 × 114.3'),
      f('centreBore', 'Centre bore', 'e.g. 64.1 mm'),
      f('lugNut', 'Wheel nut thread & torque', 'e.g. M12 × 1.5, 108 Nm'),
      f('pressureFront', 'Tyre pressure, front', 'e.g. 2.2 bar (32 psi)'),
      f('pressureRear', 'Tyre pressure, rear', 'e.g. 2.1 bar (30 psi)'),
      f('spare', 'Spare wheel', 'full-size / space saver / repair kit'),
    ],
  },
  {
    id: 'chassis',
    title: 'Chassis, brakes & steering',
    icon: 'car-brake-abs',
    fields: [
      f('suspensionFront', 'Suspension, front', 'e.g. MacPherson strut'),
      f('suspensionRear', 'Suspension, rear', 'e.g. torsion beam'),
      f('brakesFront', 'Brakes, front', 'e.g. ventilated disc 282 mm'),
      f('brakesRear', 'Brakes, rear', 'e.g. solid disc 260 mm / drum'),
      f('steering', 'Steering', 'e.g. electric power rack, 2.9 turns lock to lock'),
      f('abs', 'Driver aids', 'e.g. ABS, ESC, traction control'),
    ],
  },
  {
    id: 'fluids',
    title: 'Fluids & service capacities',
    icon: 'oil',
    fields: [
      f('oilSpec', 'Engine oil grade', 'e.g. 0W-20, API SN'),
      f('oilCapacity', 'Engine oil capacity (with filter)', 'e.g. 3.7 L'),
      f('oilFilter', 'Oil filter', 'OEM part number'),
      f('coolant', 'Coolant type & capacity', 'e.g. Honda Type 2, 5.4 L'),
      f('transmissionFluid', 'Transmission fluid & capacity', 'e.g. ATF DW-1, 3.5 L drain & fill'),
      f('brakeFluid', 'Brake fluid', 'e.g. DOT 3'),
      f('powerSteeringFluid', 'Power steering fluid', 'if hydraulic'),
      f('sparkPlugs', 'Spark plugs & gap', 'part number, gap'),
      f('acRefrigerant', 'A/C refrigerant', 'e.g. R-134a, 450 g'),
    ],
  },
  {
    id: 'electrical',
    title: 'Electrical',
    icon: 'car-battery',
    fields: [
      f('battery12v', '12 V battery', 'group size, Ah, CCA'),
      f('alternator', 'Alternator', 'A'),
      f('bulbs', 'Headlight bulbs', 'e.g. H11 low / 9005 high'),
    ],
  },
];

export const ALL_FIELDS = SPEC_CATEGORIES.flatMap((c) => c.fields);
