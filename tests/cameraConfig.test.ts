import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  DRAGGING_SMOOTH_TIME,
  FIT_POLAR,
  FOCUS_DISTANCE,
  FOV_DESKTOP,
  FOV_PHONE,
  MAX_DISTANCE,
  MAX_DISTANCE_PHONE,
  MAX_POLAR,
  MIN_DISTANCE,
  MIN_POLAR,
  PAN_BOX,
  SMOOTH_TIME,
  clampDistance,
  clampPolar,
  clampTarget,
  fitDistance,
  fitPose,
  focusPose,
  fovFor,
  fitScreenShift,
  worldPerPixel,
} from '../src/app/board3d/cameraConfig';

const deg = (rad: number) => (rad * 180) / Math.PI;

describe('camera clamps (spec 9.1)', () => {
  it('Polar_Should_StayBetween17And78DegreesFromTheZenith', () => {
    expect(deg(MIN_POLAR)).toBeCloseTo(17, 0);
    expect(deg(MAX_POLAR)).toBeCloseTo(78, 0);
    expect(clampPolar(0)).toBe(MIN_POLAR);
    expect(clampPolar(Math.PI)).toBe(MAX_POLAR);
    expect(clampPolar(1)).toBe(1);
  });
  it('Distance_Should_StayBetween6And28OnDesktop', () => {
    expect(MIN_DISTANCE).toBe(6);
    expect(MAX_DISTANCE).toBe(28);
    expect(clampDistance(1, 1280)).toBe(6);
    expect(clampDistance(99, 1280)).toBe(28);
  });
  it('Distance_Should_AllowThirtyOnAPhone', () => {
    expect(MAX_DISTANCE_PHONE).toBe(30);
    expect(clampDistance(99, 844)).toBe(30);
  });
  it('PanTarget_Should_StayInsideTheBoxOfFivePerSide', () => {
    expect(clampTarget(new Vector3(40, -9, -40)).toArray()).toEqual([5, -0.5, -5]);
    expect(clampTarget(new Vector3(1, 1, 1)).toArray()).toEqual([1, 1, 1]);
    expect(PAN_BOX.min.toArray()).toEqual([-5, -0.5, -5]);
    expect(PAN_BOX.max.toArray()).toEqual([5, 2.5, 5]);
  });
  it('Damping_Should_UseTheSpecifiedSmoothTimes', () => {
    expect(SMOOTH_TIME).toBe(0.28);
    expect(DRAGGING_SMOOTH_TIME).toBe(0.1);
  });
  it('Fov_Should_Be35OnDesktopAnd38OnAPhone', () => {
    expect(fovFor(1280)).toBe(FOV_DESKTOP);
    expect(fovFor(844)).toBe(FOV_PHONE);
  });
});

describe('Fit and Focus poses (spec 9.2)', () => {
  it('FitAt1280x720_Should_BeInTheSpecifiedDistanceRange', () => {
    const { distance } = fitPose(1280, 720);
    expect(distance).toBeGreaterThan(14);
    expect(distance).toBeLessThan(24);
  });
  it('FitOnThePhone_Should_StayWithinTheDistanceClamp', () => {
    const { distance } = fitPose(844, 390);
    expect(distance).toBeLessThanOrEqual(MAX_DISTANCE_PHONE);
    expect(distance).toBeGreaterThan(MIN_DISTANCE);
  });
  it('FitPose_Should_LookDownAt52DegreesFromTheZenith', () => {
    const { position, target } = fitPose(1280, 720);
    const offset = position.clone().sub(target);
    expect(deg(Math.acos(offset.y / offset.length()))).toBeCloseTo(deg(FIT_POLAR), 3);
  });
  it('FitFromANewAzimuth_Should_TurnTheCameraAroundTheTarget', () => {
    const quarter = fitPose(1280, 720, Math.PI / 2);
    expect(quarter.position.z).toBeCloseTo(quarter.target.z, 5);
    expect(quarter.position.x).toBeGreaterThan(quarter.target.x);
  });
  it('FitDistance_Should_ShrinkAsTheViewportGetsWider', () => {
    expect(fitDistance(2.2, 35)).toBeLessThanOrEqual(fitDistance(1.0, 35));
  });
  it('Focus_Should_ComeToSevenUnitsAtTheTokenKeepingTheAzimuth', () => {
    const { position, target } = focusPose([2, 0.22, 1], 0.5);
    expect(position.distanceTo(target)).toBeCloseTo(FOCUS_DISTANCE, 5);
    expect(target.toArray()).toEqual([2, 0.72, 1]);
    expect(Math.atan2(position.x - target.x, position.z - target.z)).toBeCloseTo(0.5, 5);
  });
});

describe('Fit composition (T44.8)', () => {
  it('FitShift_(DesktopCanvas)_Should_SlideTheBoardRightOfTheSeatCards', () => {
    expect(fitScreenShift(1280)).toBeGreaterThan(0);
    expect(fitScreenShift(1280)).toBeLessThanOrEqual(96);
  });

  it('FitShift_(PhoneCanvas)_Should_KeepTheBoardCentred', () => {
    expect(fitScreenShift(844)).toBe(0);
  });

  it('WorldPerPixel_(FitDistance)_Should_MatchTheFrustumHeightOverTheCanvas', () => {
    // 2 * 19 * tan(17.5 deg) = 11.98 u over 720 px
    expect(worldPerPixel(19, 35, 720)).toBeCloseTo(11.98 / 720, 4);
  });
});
