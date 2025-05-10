import { StatusCodes } from "http-status-codes";

import User from "../models/UserModel.js";
import Parent from "../models/ParentModel.js";
import BadRequestError from "../errors/bad-request.js";
import createTokenUser from "../utils/createTokenUser.js";
import { attachCookiesToResponse } from "../utils/jwt.js";
import InternalServerError from "../errors/internal-server-error.js";

export const registerParent = async (req, res, next) => {
  try {
    const {
      type,
      maritalStatus,
      iAm,
      schoolFeesResponsibility,
      actingAs,
      ...parentData
    } = req.body;

    const { father, mother, singleParent } = parentData;

    // Basic validation
    if (
      type === "Parent" &&
      (maritalStatus === "Married" || maritalStatus === "Separated") &&
      iAm === "False" &&
      schoolFeesResponsibility === "False"
    ) {
      throw new BadRequestError("Please provide the required fields");
    }
    if (
      type === "Guardian" &&
      (maritalStatus === "Married" || maritalStatus === "Separated") &&
      schoolFeesResponsibility === "False" &&
      actingAs === "False"
    ) {
      throw new BadRequestError("Please provide the required fields");
    }

    if (
      type === "Guardian" &&
      maritalStatus === "SingleParent" &&
      actingAs === "False" &&
      schoolFeesResponsibility === "False"
    ) {
      throw new BadRequestError("Please provide the required fields");
    }

    if (
      type === "Parent" &&
      maritalStatus === "SingleParent" &&
      iAm === "False" &&
      schoolFeesResponsibility === "False"
    ) {
      throw new BadRequestError("Please provide the required fields");
    }

    if (!father && !mother && !singleParent) {
      throw new BadRequestError(
        "At least one parent or guardian must be provided.",
      );
    }

    // Check for existing parent per role and skip if found
    const skippedParents = [];

    const rolesToCheck = [
      { role: "father", data: father },
      { role: "mother", data: mother },
      { role: "singleParent", data: singleParent },
    ];

    for (const { role, data } of rolesToCheck) {
      if (!data) continue;

      const match = await Parent.findOne({
        $or: [
          data.email ? { [`${role}.email`]: data.email } : null,
          data.phone ? { [`${role}.phone`]: data.phone } : null,
        ].filter(Boolean),
      });

      if (match) {
        const existingRoleData = match[role];

        if (existingRoleData?.status === "inactive") {
          existingRoleData.status = "active";
          await match.save();
        }

        delete parentData[role];
        skippedParents.push(role);
      }
    }

    // If all were skipped
    if (!parentData.father && !parentData.mother && !parentData.singleParent) {
      throw new BadRequestError(
        "All provided parent data already exist in the system.",
      );
    }

    // Create the parent document
    let parentPayload = {
      type,
      maritalStatus,
      iAm,
      schoolFeesResponsibility,
      actingAs,
    };

    if (parentData.father) parentPayload.father = parentData.father;
    if (parentData.mother) parentPayload.mother = parentData.mother;
    if (parentData.singleParent)
      parentPayload.singleParent = parentData.singleParent;

    const parent = new Parent(parentPayload);
    await parent.save();

    const tokenUser = createTokenUser(parent);
    attachCookiesToResponse({ res, user: tokenUser });

    res.status(StatusCodes.CREATED).json({
      message: "Parent registered successfully",
      parent,
      token: tokenUser,
    });
  } catch (error) {
    console.error("Error creating parent:", error);
    next(new InternalServerError(error.message));
  }
};
