import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';

import { createRoot } from "react-dom/client";
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <MantineProvider>
    <Notifications />
    <App />
  </MantineProvider>
);
