import "server-only";

import dataset from "./seongnam-centers.json";

export type SeongnamCenter = {
  id: string;
  administrativeCode: string | null;
  city: string;
  district: string;
  dong: string;
  centerName: string;
  postalCode: string;
  address: string;
  phone: string;
  districtOffice: string;
  districtOfficePhone: string;
  latitude: number | null;
  longitude: number | null;
  dataAsOf: string;
  sourceUpdatedAt: string;
  checkedAt: string;
  sourceId: string;
  sourceUrl: string;
};

export type CenterDatasetSource = {
  id: string;
  title: string;
  sourceUrl: string;
  sourceName: string;
  sourceUpdatedAt: string;
  updateCycle: string;
  termsStatus: "confirmed";
  termsSummary: string;
  termsUrl: string;
  checkedAt: string;
};

export type NeighborhoodOption = {
  id: string;
  city: string;
  district: string;
  dong: string;
  label: string;
  administrativeCode: string | null;
};

type CenterDataset = {
  administrativeDivisionSource: {
    id: string;
    title: string;
    sourceUrl: string;
    sourceName: string;
    updatedAt: string;
    termsStatus: "confirmed";
    termsSummary: string;
    termsUrl: string;
    recordCount: number;
    checkedAt: string;
  };
  datasets: CenterDatasetSource[];
  centers: SeongnamCenter[];
};

function confirmTermsStatus(value: string): "confirmed" {
  if (value !== "confirmed") {
    throw new Error("Unexpected resident-center data terms status.");
  }
  return value;
}

const centerDataset: CenterDataset = {
  ...dataset,
  administrativeDivisionSource: {
    ...dataset.administrativeDivisionSource,
    termsStatus: confirmTermsStatus(
      dataset.administrativeDivisionSource.termsStatus,
    ),
  },
  datasets: dataset.datasets.map((source) => ({
    ...source,
    termsStatus: confirmTermsStatus(source.termsStatus),
  })),
};

export const seongnamCenters = centerDataset.centers;
export const seongnamCenterSources = centerDataset.datasets;
export const seongnamAdministrativeDivisionSource =
  centerDataset.administrativeDivisionSource;

export function getNeighborhoodOptions(): NeighborhoodOption[] {
  return seongnamCenters.map((center) => ({
    id: center.id,
    city: center.city,
    district: center.district,
    dong: center.dong,
    label: `경기도 ${center.city} ${center.district} ${center.dong}`,
    administrativeCode: center.administrativeCode,
  }));
}

export function findSelectedCenter(location: string): SeongnamCenter | null {
  return (
    seongnamCenters.find(
      (center) =>
        location.includes(center.district) && location.includes(center.dong),
    ) ?? null
  );
}

export function resolveResidentCenter(
  question: string,
  location: string,
): { center: SeongnamCenter | null; ambiguous: boolean; explicitDong: boolean } {
  const explicitDong = question.match(/([가-힣0-9]{2,}동)(?![가-힣])/u)?.[1];
  const explicitDistrict = question.match(/(수정구|중원구|분당구)/u)?.[1];
  const selectedCenter = findSelectedCenter(location);

  if (!explicitDong) {
    return { center: selectedCenter, ambiguous: false, explicitDong: false };
  }

  let matches = seongnamCenters.filter((center) => center.dong === explicitDong);
  const selectedDistrictHasMatch = matches.some(
    (center) => center.district === selectedCenter?.district,
  );
  const district =
    explicitDistrict ??
    (selectedDistrictHasMatch ? selectedCenter?.district : undefined);
  if (district) {
    matches = matches.filter((center) => center.district === district);
  }

  return {
    center: matches.length === 1 ? matches[0] : null,
    ambiguous: matches.length > 1,
    explicitDong: true,
  };
}

export function getCenterSource(id: string): CenterDatasetSource {
  const source = seongnamCenterSources.find((item) => item.id === id);
  if (!source) throw new Error(`Unknown resident-center source: ${id}`);
  return source;
}
