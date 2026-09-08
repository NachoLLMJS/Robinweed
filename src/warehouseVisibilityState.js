export function warehouseVisibilityForLocation(location) {
  return {
    legacyInterior: location === 'warehouse',
    suppliedExterior: location === 'street',
  };
}
