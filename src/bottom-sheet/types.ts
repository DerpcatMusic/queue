export type BottomSheetMethods = {
  close: () => void;
  snapToIndex: (index: number) => void;
  present?: () => void;
  dismiss?: () => void;
};
