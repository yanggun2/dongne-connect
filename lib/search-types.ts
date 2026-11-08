import type { OfficialEvent } from "./official-events";
import type { OfficialNotice } from "./official-notices";
import type { WasteCategory, WasteHousing } from "./waste-guide";

export type SearchCategory =
  | "waste"
  | "facility"
  | "notice"
  | "event"
  | "resident_center"
  | "library"
  | "general";

export type SearchCitation = {
  id: string;
  category: SearchCategory;
  title: string;
  sourceName: string;
  sourceUrl: string;
  regionName: string;
  regionLevel: "national" | "city" | "district" | "dong";
  dataAsOf: string | null;
  checkedAt: string;
  fieldIds: string[];
};

export type FacilitySearchRecord = {
  id: string;
  name: string;
  place: string;
  facilityType: string;
  address: string;
  closedDays: string;
  weekdayHours: string;
  weekendHours: string;
  isPaid: string;
  fee: string;
  capacity: string;
  amenities: string;
  applicationMethod: string;
  latitude: string;
  longitude: string;
  administrativeDongName: string | null;
};

export type ResidentCenterSearchRecord = {
  id: string;
  administrativeCode: string | null;
  district: string;
  dong: string;
  centerName: string;
  postalCode: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  dataAsOf: string;
};

export type SearchResult =
  | { status: "waste_results"; answer: string; message: string; regionName: string; category: WasteCategory; housing: WasteHousing; sources: SearchCitation[] }
  | { status: "notice_results"; message: string; notices: OfficialNotice[]; sources: SearchCitation[] }
  | {
      status: "event_results";
      message: string;
      events: OfficialEvent[];
      sources: SearchCitation[];
    }
  | {
      status: "answered";
      answer: string;
      sources: SearchCitation[];
    }
  | {
      status: "link_only" | "insufficient" | "region_mismatch" | "timeout";
      message: string;
      sources: SearchCitation[];
    }
  | {
      status: "facility_results";
      message: string;
      total: number;
      page: number;
      pageSize: number;
      facilities: FacilitySearchRecord[];
      sources: SearchCitation[];
    }
  | {
      status: "resident_center_results";
      message: string;
      center: ResidentCenterSearchRecord;
      sources: SearchCitation[];
    };
