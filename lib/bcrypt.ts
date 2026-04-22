import bcrypt from "bcryptjs";
import * as Crypto from "expo-crypto";

bcrypt.setRandomFallback((length) => Array.from(Crypto.getRandomBytes(length)));

export default bcrypt;
