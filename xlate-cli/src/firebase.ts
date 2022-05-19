import { initializeApp } from "firebase/app";
import {
  getAuth,
  GithubAuthProvider,
  signInWithCredential,
  User,
  browserSessionPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB91QOsFjrDJuTEZzrWun27FOHzUjCSofA",
  authDomain: "xlate-dev.firebaseapp.com",
  projectId: "xlate-dev",
  storageBucket: "xlate-dev.appspot.com",
  messagingSenderId: "265463545712",
  appId: "1:265463545712:web:47db27c14bf414e90019b5",
  measurementId: "G-Q4WH5ZHDTM",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

const provider = new GithubAuthProvider();
export const auth = getAuth();

provider.addScope("repo");

provider.setCustomParameters({
  allow_signup: "false",
});

auth.onAuthStateChanged((user: User | null) => {
  if (user) {
    console.log("FIREBASE USER SIGNED IN");
  }
});

export const signinFirebase = async (githubAccessToken: string) => {
  const credential = GithubAuthProvider.credential(githubAccessToken);
  const user = await signInWithCredential(auth, credential);
  /*  
  signInWithPopup(auth, provider)
    .then((result) => {
      // This gives you a GitHub Access Token. You can use it to access the GitHub API.
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      // The signed-in user info.
      const user = result.user;
      console.log(user);
      // ...
    })
    .catch((error) => {
      console.log(error);
      // Handle Errors here.
      const errorCode = error.code;
      const errorMessage = error.message;
      // The email of the user's account used.
      const email = error.email;
      // The AuthCredential type that was used.
      const credential = GithubAuthProvider.credentialFromError(error);
      // ...
    });
    */
};
