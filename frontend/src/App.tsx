import { useState } from "react";
import {
  AppBar,
  Box,
  CssBaseline,
  Tab,
  Tabs,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";

import SettingsPage from "./pages/Settings";
import RealtimePage from "./pages/Realtime";
import HistoryPage from "./pages/History";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0061ff",
    },
  },
});

export default function App() {
  const [tab, setTab] = useState(0);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "#eef2f7" }}>
        <AppBar position="static" color="primary" elevation={1}>
          <Toolbar sx={{ maxWidth: 1200, mx: "auto", width: "100%" }}>
            <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
              Longbridge Quant Console
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              本地量化沙盘
            </Typography>
          </Toolbar>
        </AppBar>
        <Box sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={tab}
            onChange={(_event, value) => setTab(value)}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab label="基础配置" />
            <Tab label="实时行情" />
            <Tab label="历史K线" />
          </Tabs>
        </Box>
        {tab === 0 ? <SettingsPage /> : tab === 1 ? <RealtimePage /> : <HistoryPage />}
      </Box>
    </ThemeProvider>
  );
}
