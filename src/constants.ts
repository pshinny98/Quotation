export const PRODUCT_CATEGORIES = {
  'Living Room Furniture': [
    'Sectional Sofa',
    'Leather/Fabric Sofa',
    'Leisure chair',
    'Sofa Chair',
    'Ottoman',
    'Functional Sofa/Chairs'
  ],
  'Restaurant Furniture': [
    '1950s Retro Diner Furniture',
    'Restaurant Set',
    'Restaurant Soft',
    'Restaurant Wood',
    'Restaurant Metal'
  ],
  'Hotel Furniture': [
    'Lobby Sofa',
    'Leisure Sofa Chair',
    'Banquet Chair'
  ],
  'Bar Furniture': [
    'Sofa',
    'Bar Set'
  ]
} as const;

export type CategoryName = keyof typeof PRODUCT_CATEGORIES;
