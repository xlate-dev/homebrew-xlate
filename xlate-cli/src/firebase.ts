import * as fs from "fs";
import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
  User,
  UserCredential,
} from "firebase/auth";
import {
  connectStorageEmulator,
  getStorage,
  ref,
  uploadBytes,
  getStream,
} from "firebase/storage";
import {
  getFirestore,
  addDoc,
  collection,
  updateDoc,
  DocumentReference,
  DocumentData,
  Unsubscribe as FirestoreUnsubscribe,
  query,
  where,
  QuerySnapshot,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";

import { logger } from "./logger";
import { TranslationTask } from "./shared/xlate";
import { xlateDevOrigin } from "./api";

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

export const isSimulator = false;

if (isSimulator) {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(firestore, "localhost", 8080);
  connectStorageEmulator(storage, "localhost", 9199);
}

export const getXlateDevOrigin = () => {
  if (isSimulator) {
    return "http://localhost:5002";
  } else return xlateDevOrigin;
};

export const getStorageRef = (path: string) => {
  return ref(storage, path);
};

export const getBucketStream = getStream;

export const uploadFile = async (
  localPath: string,
  remotePath: string,
  project: string | undefined = undefined
) => {
  const ref = getStorageRef(remotePath);
  const buf = fs.readFileSync(localPath);
  return await uploadBytes(
    ref,
    buf,
    project
      ? {
          customMetadata: {
            project: project,
          },
        }
      : undefined
  );
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

export const listenToTask = (
  id: string,
  client: string,
  onSnap: (querySnapshot: QuerySnapshot<DocumentData>) => void
): FirestoreUnsubscribe => {
  const q = query(
    collection(firestore, "translateTasks"),
    where("client", "==", client),
    where("id", "==", id)
  );
  const unsub = onSnapshot(q, (querySnapshot) => {
    onSnap(querySnapshot);
  });
  return unsub;
};

auth.onAuthStateChanged(async (user: User | null) => {
  if (user) {
    logger.info("User authorized");
  }
});

export const signinFirebase = async (
  githubAccessToken: string
): Promise<UserCredential> => {
  const credential = isSimulator
    ? GoogleAuthProvider.credential(
        '{"sub": "abc123", "email": "foo@example.com", "email_verified": true}'
      )
    : GithubAuthProvider.credential(githubAccessToken);
  const user = await signInWithCredential(auth, credential);
  return user;
  //ToDo implement refreshtoken
};
