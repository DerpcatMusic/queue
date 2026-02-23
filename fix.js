const fs = require('fs');
const files = [
      'components/maps/instructor-zones-map-component.native.tsx',
      'components/maps/onboarding-location-map.native.tsx',
      'components/maps/zones-map-web-base.tsx'
];

files.forEach(f => {
      let s = fs.readFileSync(f, 'utf8');

      // Remove `as any` from mapPalette properties
      s = s.replace(/mapPalette\.(\w+) as any/g, 'mapPalette.$1');
      s = s.replace(/\(mapPalette\.(\w+) as any\)/g, 'mapPalette.$1');

      // Remove `as any` from Brand properties
      s = s.replace(/Brand\.(\w+) as any/g, 'Brand.$1');

      // Change Brand.surface back to Brand.light.surface for these files (since they expect string primitives for RN maps if Brand is not handled, wait, Brand is handled. Brand still has PlatformColor!
      // BUT the map components shouldn't use Brand for dynamic color if MapLibre expects Hex. Wait, Brand.surface is `PlatformColor`.
      // I must pass explicit Hex to MapLibre. In MapBrandPalette we have `styleBackground`. I should use it!
      s = s.replace(/Brand\.surface/g, 'mapPalette.surfaceAlt');
      s = s.replace(/Brand\.appBg/g, 'mapPalette.styleBackground');
      s = s.replace(/Brand\.text/g, 'mapPalette.text');

      // Introduce useColorScheme
      s = s.replace(/const mapPalette = MapBrandPalette;/g, 'const uiColorScheme = useColorScheme() ?? "light";\n  const mapPalette = MapBrandPalette[uiColorScheme];');
      s = s.replace(/const mapPalette = MapBrandPalette;/g, 'const uiColorScheme = useColorScheme() ?? "light";\n  const mapPalette = MapBrandPalette[uiColorScheme];'); // just in case

      // Add import if missing
      if (!s.includes('useColorScheme')) {
            s = s.replace(/(import .* from "@\/constants\/zones-map";)/, '$1\nimport { useColorScheme } from "@/hooks/use-color-scheme";');
      }

      fs.writeFileSync(f, s);
});
console.log('Done!');
