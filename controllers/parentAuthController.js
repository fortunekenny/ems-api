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

    // Recommended required fields for validation
    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "password",
      "phone",
      "occupation",
    ];
    const requiredAddressFields = ["streetName", "townOrCity"];

    function checkRecommendedFields(obj, role) {
      if (!obj) throw new BadRequestError(`Missing ${role} data`);
      for (const field of requiredFields) {
        if (!obj[field] || obj[field] === "") {
          throw new BadRequestError(
            `Missing required field '${field}' for ${role}`,
          );
        }
      }
      if (!obj.address) {
        throw new BadRequestError(`Missing address for ${role}`);
      }
      for (const addrField of requiredAddressFields) {
        if (!obj.address[addrField] || obj.address[addrField] === "") {
          throw new BadRequestError(
            `Missing required address field '${addrField}' for ${role}`,
          );
        }
      }
    }

    // Enhanced validation for Parent/Married
    if (type === "Parent" && maritalStatus === "Married") {
      checkRecommendedFields(father, "father");
      checkRecommendedFields(mother, "mother");
      if (iAm === "False" && schoolFeesResponsibility === "False") {
        throw new BadRequestError("Please provide the required fields");
      }
    }
    // Enhanced validation for Parent/SingleParent
    if (type === "Parent" && maritalStatus === "SingleParent") {
      checkRecommendedFields(singleParent, "singleParent");
      if (iAm === "False" && schoolFeesResponsibility === "False") {
        throw new BadRequestError("Please provide the required fields");
      }
    }

    // Enhanced validation for Guardian/Married
    if (type === "Guardian" && maritalStatus === "Married") {
      checkRecommendedFields(father, "father");
      checkRecommendedFields(mother, "mother");
      if (actingAs === "False" && schoolFeesResponsibility === "False") {
        throw new BadRequestError("Please provide the required fields");
      }
    }
    // Enhanced validation for Guardian/SingleParent
    if (type === "Guardian" && maritalStatus === "SingleParent") {
      checkRecommendedFields(singleParent, "singleParent");
      if (actingAs === "False" && schoolFeesResponsibility === "False") {
        throw new BadRequestError("Please provide the required fields");
      }
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

    if (maritalStatus === "Married") {
      if (parentData.father) parentPayload.father = parentData.father;
      if (parentData.mother) parentPayload.mother = parentData.mother;
    } else if (maritalStatus === "SingleParent") {
      if (parentData.singleParent)
        parentPayload.singleParent = parentData.singleParent;
    }

    // Remove any undefined keys to prevent empty subdocs
    Object.keys(parentPayload).forEach((key) => {
      if (parentPayload[key] === undefined) {
        delete parentPayload[key];
      }
    });

    // Remove any singleParent, father, or mother from parentPayload if not appropriate
    if (maritalStatus === "Married" && parentPayload.singleParent) {
      delete parentPayload.singleParent;
    }
    if (maritalStatus === "SingleParent") {
      if (parentPayload.father) delete parentPayload.father;
      if (parentPayload.mother) delete parentPayload.mother;
    }

    const parent = new Parent(parentPayload);
    await parent.save();

    const tokenUser = createTokenUser(parent);
    attachCookiesToResponse({ res, user: tokenUser });

    // Remove password fields from response
    if (parent.father && parent.father.password)
      parent.father.password = undefined;
    if (parent.mother && parent.mother.password)
      parent.mother.password = undefined;
    if (parent.singleParent && parent.singleParent.password)
      parent.singleParent.password = undefined;

    res.status(StatusCodes.CREATED).json({
      message: "Parent registered successfully",
      parent,
      token: tokenUser,
    });
  } catch (error) {
    console.log("Error creating parent:", error);
    next(new InternalServerError(error.message));
  }
};
