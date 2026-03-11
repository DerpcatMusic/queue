import { describe, expect, it } from "bun:test";

import { ZONE_OPTIONS } from "@/constants/zones";

import { buildZoneCityGroups, buildZoneCityListItems } from "./zone-city-tree";

describe("zone city tree", () => {
  it("groups zone variants under the same city", () => {
    const groups = buildZoneCityGroups(ZONE_OPTIONS);
    const rishonGroup = groups.find((group) => group.cityLabel.en === "Rishon LeZion");

    expect(rishonGroup).toBeDefined();
    expect(rishonGroup?.zones.map((zone) => zone.label.en).sort()).toEqual([
      "Rishon LeZion - East",
      "Rishon LeZion - West",
    ]);
    expect(rishonGroup?.zones.map((zone) => zone.variantLabel.en).sort()).toEqual(["East", "West"]);
  });

  it("expands matching city groups into city and child rows", () => {
    const groups = buildZoneCityGroups(ZONE_OPTIONS);
    const rishonGroup = groups.find((group) => group.cityLabel.en === "Rishon LeZion");

    expect(rishonGroup).toBeDefined();
    if (!rishonGroup) {
      throw new Error("Expected Rishon LeZion group to exist");
    }

    const items = buildZoneCityListItems({
      groups: [rishonGroup],
      language: "en",
      query: "",
      expandedCityKeys: new Set([rishonGroup.cityKey]),
      selectedZoneIds: new Set([rishonGroup.zones[0]?.id ?? ""]),
    });

    expect(items.map((item) => item.kind)).toEqual(["city", "zone", "zone"]);
    expect(items[0]).toMatchObject({
      kind: "city",
      selectedCount: 1,
      expanded: true,
    });
  });
});
