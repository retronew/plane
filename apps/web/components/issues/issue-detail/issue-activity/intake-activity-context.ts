import { createContext } from "react";

export const IntakeActivityContext = createContext(false);

// Presentation only; notification details retain regular issue operations.
export const ActivityDisplayContext = createContext(false);
