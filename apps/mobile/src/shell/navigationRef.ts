import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootParamList } from "./navigation";

// Navigation consumers must not initialize every host screen to get the ref.
export const shellNavigationRef = createNavigationContainerRef<RootParamList>();
