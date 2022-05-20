import { initializeApp } from "firebase/app";
import {
  getAuth,
  GithubAuthProvider,
  signInWithCredential,
  User,
  UserCredential,
} from "firebase/auth";
import { getStorage, ref } from "firebase/storage";
import {
  getFirestore,
  addDoc,
  collection,
  updateDoc,
  DocumentReference,
} from "firebase/firestore";
import { logger } from "./logger";
import { TranslationTask } from "./shared/xlate";

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

export const auth = getAuth(app);
export const storage = getStorage(app);
export const firestore = getFirestore(app);

export const getStorageRef = (path: string) => {
  return ref(storage, path);
};

export const addTranslationDoc = async (doc: TranslationTask) => {
  return await addDoc(collection(firestore, "translateTasks"), doc);
};

export const updateTranslationDoc = async (
  ref: DocumentReference<Partial<TranslationTask>>,
  data: Partial<TranslationTask>
) => {
  return await updateDoc(ref, data);
};

auth.onAuthStateChanged(async (user: User | null) => {
  if (user) {
    logger.info("FIREBASE USER SIGNED IN");
  }
});

export const signinFirebase = async (
  githubAccessToken: string
): Promise<UserCredential> => {
  const credential = GithubAuthProvider.credential(githubAccessToken);
  const user = await signInWithCredential(auth, credential);
  return user;
  //ToDo implement refreshtoken
};
