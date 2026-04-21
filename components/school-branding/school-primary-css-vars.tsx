import {
  hexToRgb,
  resolveSchoolPrimaryHex,
} from "@/lib/school-primary-color";

export function SchoolPrimaryCssVars({
  primaryColor,
}: {
  primaryColor: string | null | undefined;
}) {
  const hex = resolveSchoolPrimaryHex(primaryColor);
  const rgb = hexToRgb(hex);
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root { --school-primary: ${hex}; --school-primary-rgb: ${rgb}; }`,
      }}
    />
  );
}
