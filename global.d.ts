// Global type declarations for the project

/// <reference types="react" />
/// <reference types="react-native" />

// Extend module declarations
declare module "*.png" {
  const value: import("react-native").ImageSourcePropType;
  export default value;
}

declare module "*.jpg" {
  const value: import("react-native").ImageSourcePropType;
  export default value;
}

declare module "*.jpeg" {
  const value: import("react-native").ImageSourcePropType;
  export default value;
}

declare module "*.gif" {
  const value: import("react-native").ImageSourcePropType;
  export default value;
}

declare module "*.svg" {
  import React from "react";
  import { SvgProps } from "react-native-svg";
  const content: React.FC<SvgProps>;
  export default content;
}

declare module "*.json" {
  const value: any;
  export default value;
}

// Environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    EXPO_PUBLIC_API_URL?: string;
    PORT?: string;
  }
}

// React Navigation types
declare global {
  namespace ReactNavigation {
    interface RootParamList {
      [key: string]: undefined | object;
    }
  }
}

export {};
