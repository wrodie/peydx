// src/constants/departments.ts

export const DEPARTMENTS = [
  { label: 'Childrens Ministry', value: 'children' },
  { label: 'Digital Signage', value: 'signage' },
  { label: 'Youth Ministry', value: 'youth' }, // Easy to add more later
] as const;

// Helper to get just the values for validation or access control
export const DEPARTMENT_VALUES = DEPARTMENTS.map(d => d.value);
