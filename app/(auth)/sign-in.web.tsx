import { useAuth } from "@clerk/clerk-expo";
import { SignIn } from "@clerk/clerk-expo/web";
import { Redirect } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function SignInWebScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.container}>
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f3f6fb",
  },
});
