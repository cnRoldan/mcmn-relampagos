import "react-native-gesture-handler";
import React from "react";
import { Text, View, useWindowDimensions } from "react-native";
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
import { Provider } from "./src/state/AppState";
import {
  Home,
  Nights,
  Clubs,
  Tournaments,
  Settings,
} from "./src/screens/Screens";
import { colors } from "./src/theme";
import type { Routes } from "./src/navigation";
const Drawer = createDrawerNavigator<Routes>();
function SideMenu(props: DrawerContentComponentProps) {
  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ flexGrow: 1, paddingTop: 45 }}
    >
      <View style={{ padding: 22, marginBottom: 25 }}>
        <Text style={{ fontSize: 28, fontWeight: "900", color: colors.lime }}>
          ϟ RELÁMPAGOS
        </Text>
        <Text
          style={{
            fontSize: 10,
            letterSpacing: 3,
            color: "#A1B29E",
            marginTop: 8,
          }}
        >
          CLUBES PRO
        </Text>
      </View>
      <Text
        style={{
          fontSize: 10,
          letterSpacing: 2,
          color: "#85977E",
          paddingHorizontal: 25,
          marginBottom: 18,
        }}
      >
        TU COMUNIDAD
      </Text>
      <DrawerItemList {...props} />
      <View style={{ marginTop: "auto", padding: 25, gap: 8 }}>
        <Text style={{ color: colors.lime, fontSize: 12 }}>
          ● Panel del organizador
        </Text>
        <Text style={{ color: "#8A9D85", fontSize: 11, lineHeight: 17 }}>
          Versión inicial · datos locales{`\n`}Nombre provisional
        </Text>
      </View>
    </DrawerContentScrollView>
  );
}
export default function App() {
  const { width } = useWindowDimensions();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider>
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
                drawerActiveBackgroundColor: "#2B3E27",
                drawerActiveTintColor: colors.lime,
                drawerInactiveTintColor: "#BAC8B4",
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
              <Drawer.Screen
                name="Noches"
                component={Nights}
                options={{ title: "Noches de juego" }}
              />
              <Drawer.Screen
                name="Clubes"
                component={Clubs}
                options={{ title: "Clubes inscritos" }}
              />
              <Drawer.Screen name="Relámpagos" component={Tournaments} />
              <Drawer.Screen name="Ajustes" component={Settings} />
            </Drawer.Navigator>
          </NavigationContainer>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
