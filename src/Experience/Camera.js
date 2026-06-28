import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';

const CAMERA_PRESETS = {
  DEFAULT: {
    position: { x: -4.219, y: -0.709, z: 59.586 },
    target: { x: -10.179, y: -1.894, z: 4.908 },
    duration: 1.2,
  },
  CLICK_DUMMY: {
  position: { x: -17.767, y: -8.458, z: 31.208 },
  target: { x: -20.779, y: -8.865, z: 11.066 },
  duration: 1.2,
  },
  CLICK_CPU: {
  position: { x: -10.029, y: -1.927, z: 16.287 },
  target: { x: -10.179, y: -1.894, z: 4.908 },
  duration: 1.2,
  },
  CLICK_GPU: {
  position: { x: -8.876, y: -5.993, z: 17.177 },
  target: { x: -8.889, y: -6.372, z: 8.553 },
  duration: 1.2,
  },
  CLICK_RAM: {
  position: { x: -8.870, y: -0.991, z: 10.901 },
  target: { x: -7.117, y: -1.598, z: 3.514 },
  duration: 1.2,
  },
  CLICK_FANS: {
  position: { x: -1.392, y: -4.757, z: 14.529 },
  target: { x: -1.730, y: -12.002, z: 6.481 },
  duration: 1.2,
  },
  CLICK_CABLES: {
  position: { x: -6.051, y: -8.065, z: 16.135 },
  target: { x: -5.433, y: -8.068, z: 9.645 },
  duration: 1.2,
  },
  CLICK_CASE: {
  position: { x: 3.350, y: 1.900, z: 3.650 },
  target: { x: 0.250, y: 0.920, z: 0.000 },
  duration: 1.2,
  },
};

export default class Camera {
  constructor(experience) {
    this.experience = experience;
    this.sizes = experience.sizes;
    this.scene = experience.scene;
    this.canvas = experience.canvas;

    this.instance = new THREE.PerspectiveCamera(
      45,
      this.sizes.width / this.sizes.height,
      0.1,
      100
    );
    this.instance.position.set(
      CAMERA_PRESETS.DEFAULT.position.x,
      CAMERA_PRESETS.DEFAULT.position.y,
      CAMERA_PRESETS.DEFAULT.position.z
    );
    this.scene.add(this.instance);

    this.controls = new OrbitControls(this.instance, this.canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.screenSpacePanning = true;
    this.controls.target.set(
      CAMERA_PRESETS.DEFAULT.target.x,
      CAMERA_PRESETS.DEFAULT.target.y,
      CAMERA_PRESETS.DEFAULT.target.z
    );
    this.controls.update();

    this.activeTweens = [];
    this.transitionId = 0;
    this.currentPresetName = 'DEFAULT';
    this.calibrationTarget = null;

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();

      if (key === 'f') {
        this.frameCalibrationTarget();
      } else if (key === 'p') {
        this.logCurrentPreset();
      } else if (key === 'd') {
        this.logCurrentPreset('DEFAULT');
      } else if (key === '0') {
        this.moveToDefault();
      }
    });
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height;
    this.instance.updateProjectionMatrix();
  }

  update() {
    this.controls.update();
  }

  moveToPreset(presetName) {
    const selectedPresetName = Object.hasOwn(CAMERA_PRESETS, presetName)
      ? presetName
      : 'DEFAULT';
    const preset = CAMERA_PRESETS[selectedPresetName];

    this.transitionId += 1;
    const transitionId = this.transitionId;

    this.activeTweens.forEach((tween) => tween.kill());
    this.activeTweens = [];
    this.currentPresetName = selectedPresetName;
    this.controls.enabled = false;

    const duration = preset.duration ?? 1.2;
    const ease = 'power2.inOut';
    let completedTweens = 0;

    const handleUpdate = () => {
      this.controls.update();
    };

    const handleComplete = () => {
      completedTweens += 1;

      if (completedTweens < 2 || transitionId !== this.transitionId) {
        return;
      }

      this.controls.enabled = true;
      this.controls.update();
      this.activeTweens = [];
    };

    const positionTween = gsap.to(this.instance.position, {
      x: preset.position.x,
      y: preset.position.y,
      z: preset.position.z,
      duration,
      ease,
      onUpdate: handleUpdate,
      onComplete: handleComplete,
    });

    const targetTween = gsap.to(this.controls.target, {
      x: preset.target.x,
      y: preset.target.y,
      z: preset.target.z,
      duration,
      ease,
      onUpdate: handleUpdate,
      onComplete: handleComplete,
    });

    this.activeTweens = [positionTween, targetTween];
  }

  moveToDefault() {
    this.moveToPreset('DEFAULT');
  }

  setCalibrationTarget(object) {
    this.calibrationTarget = object;
    console.log(`Calibration target set: ${object.name}`);
  }

  frameCalibrationTarget() {
    if (!this.calibrationTarget) {
      console.warn(
        'Calibration target missing: click a CLICK_ target before pressing F.'
      );
      return;
    }

    const box = new THREE.Box3().setFromObject(this.calibrationTarget);

    if (box.isEmpty()) {
      console.warn(
        `Cannot frame calibration target: ${this.calibrationTarget.name} has an empty bounding box.`
      );
      return;
    }

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxSize = Math.max(size.x, size.y, size.z);
    const distance = Math.max(maxSize * 3, 1.2);
    const direction = new THREE.Vector3();
    this.instance.getWorldDirection(direction);
    direction.multiplyScalar(-1).normalize();

    const newPosition = center
      .clone()
      .add(direction.multiplyScalar(distance));

    this.transitionId += 1;
    const transitionId = this.transitionId;

    this.activeTweens.forEach((tween) => tween.kill());
    this.activeTweens = [];
    this.controls.enabled = false;

    let completedTweens = 0;

    const handleUpdate = () => {
      this.controls.update();
    };

    const handleComplete = () => {
      completedTweens += 1;

      if (completedTweens < 2 || transitionId !== this.transitionId) {
        return;
      }

      this.controls.enabled = true;
      this.controls.update();
      this.activeTweens = [];
    };

    const positionTween = gsap.to(this.instance.position, {
      x: newPosition.x,
      y: newPosition.y,
      z: newPosition.z,
      duration: 0.8,
      ease: 'power2.inOut',
      overwrite: true,
      onUpdate: handleUpdate,
      onComplete: handleComplete,
    });

    const targetTween = gsap.to(this.controls.target, {
      x: center.x,
      y: center.y,
      z: center.z,
      duration: 0.8,
      ease: 'power2.inOut',
      overwrite: true,
      onUpdate: handleUpdate,
      onComplete: handleComplete,
    });

    this.activeTweens = [positionTween, targetTween];
  }

  logCurrentPreset(presetName) {
    const resolvedPresetName =
      presetName ??
      this.currentPresetName ??
      this.calibrationTarget?.name ??
      'COPY_ME';
    const format = (value) =>
      Math.abs(value) < 0.0005 ? '0.000' : value.toFixed(3);
    const position = this.instance.position;
    const target = this.controls.target;

    console.log(`${resolvedPresetName}: {
  position: { x: ${format(position.x)}, y: ${format(position.y)}, z: ${format(position.z)} },
  target: { x: ${format(target.x)}, y: ${format(target.y)}, z: ${format(target.z)} },
  duration: 1.2,
},`);
  }
}

export { CAMERA_PRESETS };
