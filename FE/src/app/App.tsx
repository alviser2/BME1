import React from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { IVBagProvider } from "./context/IVBagContext";
import { Toaster } from "sonner";

export default function App() {
  return (
    <IVBagProvider>
      <Toaster position="top-right" richColors />
      <RouterProvider router={router} />
    </IVBagProvider>
  );
}
