/** The 8 HYROX workout stations, always performed in this order, each preceded by a 1 km run. */
export type StationId =
  | 'skierg'
  | 'sledPush'
  | 'sledPull'
  | 'burpeeBroadJump'
  | 'row'
  | 'farmersCarry'
  | 'sandbagLunges'
  | 'wallBalls';

export interface StationInfo {
  id: StationId;
  /** Label as printed on HYROX result pages. */
  name: string;
  short: string;
  distance: string;
}

export const STATIONS: readonly StationInfo[] = [
  { id: 'skierg', name: 'SkiErg', short: 'SKI', distance: '1000m' },
  { id: 'sledPush', name: 'Sled Push', short: 'PUSH', distance: '50m' },
  { id: 'sledPull', name: 'Sled Pull', short: 'PULL', distance: '50m' },
  { id: 'burpeeBroadJump', name: 'Burpee Broad Jump', short: 'BBJ', distance: '80m' },
  { id: 'row', name: 'Rowing', short: 'ROW', distance: '1000m' },
  { id: 'farmersCarry', name: 'Farmers Carry', short: 'FARM', distance: '200m' },
  { id: 'sandbagLunges', name: 'Sandbag Lunges', short: 'LUNGE', distance: '100m' },
  { id: 'wallBalls', name: 'Wall Balls', short: 'WB', distance: '100 reps' },
];

export const STATION_IDS: readonly StationId[] = STATIONS.map((s) => s.id);
