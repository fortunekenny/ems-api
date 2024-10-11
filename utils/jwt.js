// import { sign, verify } from "jsonwebtoken";
import pkg from "jsonwebtoken";
const { sign, verify } = pkg;

export const createJWT = ({ payload }) => {
  const token = sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_LIFETIME,
  });
  return token;
};

export const isTokenValid = ({ token }) =>
  verify(token, process.env.JWT_SECRET);

export const attachCookiesToResponse = ({ res, user }) => {
  const token = createJWT({ payload: user });

  const oneDay = 1000 * 60 * 60 * 24;

  res.cookie("token", token, {
    httpOnly: true,
    expires: new Date(Date.now() + oneDay),
    secure: process.env.NODE_ENV === "production",
    signed: true,
  });
};

// export default {
//   createJWT,
//   isTokenValid,
//   attachCookiesToResponse,
// };
