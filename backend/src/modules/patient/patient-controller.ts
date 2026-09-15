import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { BadRequestError } from "../../shared/middleware/error-handler";
import { logger } from "../../config/logger";
import {
  createPatientSchema,
  listPatientsQuerySchema,
  updatePatientSchema,
} from "./patient-schema";
import {
  createPatient,
  listPatients,
  getPatientById,
  softDeletePatient,
  updatePatient,
} from "./patient-service";
import { maskPatientForLog } from "../../shared/utils/pii-sanitizer";

const patientIdParamSchema = z.string().uuid();

/** Wraps an async route handler so rejected promises reach the error-handler middleware. */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function parsePatientId(rawId: string): string {
  const result = patientIdParamSchema.safeParse(rawId);
  if (!result.success) {
    throw new BadRequestError("patient_id must be a valid UUID.");
  }
  return result.data;
}

export const patientRouter = Router();

patientRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listPatientsQuerySchema.parse(req.query);
    const patients = await listPatients(query);
    res.envelope(patients, 200);
  }),
);

patientRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const patientId = parsePatientId(req.params.id);
    const patient = await getPatientById(patientId);
    res.envelope(patient, 200);
  }),
);

patientRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createPatientSchema.parse(req.body);
    const patient = await createPatient(input);
    logger.info({ patient: maskPatientForLog(patient as unknown as Record<string, unknown>) }, "patient_registered_via_api");
    res.envelope(patient, 201);
  }),
);

patientRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const patientId = parsePatientId(req.params.id);
    const input = updatePatientSchema.parse(req.body);
    const patient = await updatePatient(patientId, input);
    logger.info({ patient: maskPatientForLog(patient as unknown as Record<string, unknown>) }, "patient_updated_via_api");
    res.envelope(patient, 200);
  }),
);

patientRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const patientId = parsePatientId(req.params.id);
    await softDeletePatient(patientId);
    logger.info({ patient_id: patientId }, "patient_soft_deleted_via_api");
    res.envelope({ patient_id: patientId, deleted: true }, 200);
  }),
);
