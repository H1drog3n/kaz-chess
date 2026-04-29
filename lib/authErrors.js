export function friendlyAuthError(err) {
  const code = err?.code || err?.errorCode || "";
  // Firebase v9/10 uses codes like "auth/user-not-found"
  switch (code) {
    case "auth/user-not-found":
      return "User not found";
    case "auth/wrong-password":
      return "Incorrect password";
    case "auth/email-already-in-use":
      return "Email is already in use";
    case "auth/weak-password":
      return "Password is too weak";
    case "auth/requires-recent-login":
      return "Please log in again and retry.";
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Invalid credentials";
    case "auth/invalid-email":
      return "Invalid email";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled";
    case "auth/configuration-not-found":
      return "Auth provider is not configured";
    case "auth/popup-closed-by-user":
      return "Popup closed";
    case "auth/popup-blocked":
      return "Popup blocked by browser";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    default:
      return "Invalid credentials";
  }
}

