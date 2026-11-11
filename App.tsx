import "react-native-gesture-handler";
import React from "react";
import {
  Text,
  View,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerToggleButton,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { StatusBar } from "expo-status-bar";
import { useApp } from "./src/state/AppState";
import { AuthProvider, useAuth } from "./src/cloud/AuthProvider";
import { AuthScreen } from "./src/screens/AuthScreen";
import { Provider } from "./src/state/AppState";
import {
  Home,
  TournamentHub,
  MyClub,
  Honours,
  Settings,
} from "./src/screens/Screens";
import { BrandLogo } from "./src/components/BrandLogo";
import { colors } from "./src/theme";
import type { Routes } from "./src/navigation";
const Drawer = createDrawerNavigator<Routes>();
function SideMenu(props: DrawerContentComponentProps) {
  const { mode, isAdmin } = useApp();
  const { profile } = useAuth();
  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ flexGrow: 1, paddingTop: 45 }}
    >
      <View style={{ padding: 18, marginBottom: 25 }}>
        <BrandLogo />
      </View>
      <Text
        style={{
          fontSize: 10,
          letterSpacing: 2,
          color: colors.onDarkMuted,
          paddingHorizontal: 25,
          marginBottom: 18,
        }}
      >
        TU COMUNIDAD
      </Text>
      <DrawerItemList {...props} />
      <View style={{ marginTop: "auto", padding: 25, gap: 8 }}>
        <Text style={{ color: colors.accent, fontSize: 12 }}>
          {isAdmin ? "● Panel del organizador" : "● Acceso de capitán"}
        </Text>
        <Text
          style={{ color: colors.onDarkMuted, fontSize: 11, lineHeight: 17 }}
        >
          {mode === "cloud"
            ? profile?.ea_id
            : "Versión de prueba · datos locales"}
        </Text>
      </View>
    </DrawerContentScrollView>
  );
}
function AppNavigator() {
  const { width } = useWindowDimensions();
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.bg,
          primary: colors.dark,
        },
      }}
    >
      <StatusBar style="dark" />
      <Drawer.Navigator
        drawerContent={(p) => <SideMenu {...p} />}
        screenOptions={{
          drawerType: width >= 900 ? "permanent" : "front",
          drawerStyle: { width: 280, backgroundColor: colors.dark },
          drawerActiveBackgroundColor: colors.selected,
          drawerActiveTintColor: colors.accent,
          drawerInactiveTintColor: colors.onDark,
          drawerLabelStyle: { fontSize: 14, fontWeight: "600" },
          drawerItemStyle: { borderRadius: 10, marginHorizontal: 13 },
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontSize: 17, fontWeight: "600" },
          headerShadowVisible: false,
          swipeEnabled: true,
          overlayAccessibilityLabel: "Cerrar menú",
          headerLeft: () =>
            width >= 900 ? null : (
              <DrawerToggleButton
                accessibilityLabel="Abrir menú"
                tintColor={colors.ink}
              />
            ),
        }}
      >
        <Drawer.Screen
          name="Inicio"
          component={Home}
          options={{ title: "Inicio" }}
        />
        <Drawer.Screen name="Torneos" component={TournamentHub} />
        <Drawer.Screen name="Mi Club" component={MyClub} />
        <Drawer.Screen name="Palmarés" component={Honours} />
        <Drawer.Screen name="Ajustes" component={Settings} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

function SessionGate() {
  const { configured, loading, session } = useAuth();
  if (configured && loading)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  if (configured && !session) return <AuthScreen />;
  return (
    <Provider key={session?.user.id || "local-preview"}>
      <AppNavigator />
    </Provider>
  );
}
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <SessionGate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
