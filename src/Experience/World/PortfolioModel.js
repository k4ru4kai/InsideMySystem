import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CLICK_LAYER = 1;
const FAN_CONFIGS = [
  { name: 'FAN_ROT_Y_1', axis: 'y' },
  { name: 'FAN_ROT_Y_2', axis: 'y' },
  { name: 'FAN_ROT_Y_3', axis: 'y' },
  {name: 'FAN_ROT_Z_1',axis: 'z'},
  {name: 'FAN_ROT_Z_2',axis: 'z'},
  {name: 'FAN_ROT_Z_3',axis: 'z'},
  { name: 'FAN_ROT_Z_4', axis: 'z' },
  { name: 'FAN_ROT_Z_5', axis: 'z' },
  { name: 'FAN_ROT_Z_6', axis: 'z' },
];
const FAN_TARGET_SPEED = 18;
const FAN_ACCELERATION = 6;

const SECTION_BY_OBJECT = {
  CLICK_DUMMY: {
    title: 'Intro',
    text: 'Dummy introduces the interactive portfolio and guides the visitor through the scene.',
  },
  CLICK_CPU: {
    title: 'About me',
    text: 'Personal profile, background, and main interests.',
  },
  CLICK_GPU: {
    title: 'Projects',
    text: 'Selected technical and creative projects.',
  },
  CLICK_RAM: {
    title: 'Academic',
    text: 'University path, relevant exams, and academic skills.',
  },
  CLICK_FANS: {
    title: 'Work experience',
    text: 'Professional experiences, tutoring, and applied activities.',
  },
  CLICK_CABLES: {
    title: 'Hobby and interests',
    text: 'Creative interests, drawing, games, cinema, and personal passions.',
  },
  CLICK_CASE: {
    title: 'Contact me',
    text: 'Contact information and external links.',
  },
};

export default class PortfolioModel {
  constructor(experience) {
    this.scene = experience.scene;
    this.loadingScreen = document.querySelector('#loading-screen');
    this.clickTargets = [];
    this.fanRotors = [];
    this.fanEnabled = true;
    this.fanCurrentSpeed = 0;
    this.loadedModel = null;

    this.setPlaceholder();
    this.loadModel();
  }

  setPlaceholder() {
    this.placeholderGroup = new THREE.Group();
    this.scene.add(this.placeholderGroup);

    const caseGeometry = new THREE.BoxGeometry(1.8, 1.7, 1.05);
    const caseMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2f2f2,
      roughness: 0.38,
      metalness: 0.12,
    });

    const placeholderCase = new THREE.Mesh(caseGeometry, caseMaterial);
    placeholderCase.position.set(0.45, 0.85, 0);
    placeholderCase.castShadow = true;
    placeholderCase.receiveShadow = true;
    this.placeholderGroup.add(placeholderCase);

    const glassGeometry = new THREE.PlaneGeometry(1.55, 1.35);
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x9bdcff,
      transparent: true,
      opacity: 0.24,
      roughness: 0.05,
      metalness: 0.0,
      transmission: 0.35,
    });

    const placeholderGlass = new THREE.Mesh(glassGeometry, glassMaterial);
    placeholderGlass.position.set(0.45, 0.86, 0.531);
    placeholderGlass.castShadow = false;
    this.placeholderGroup.add(placeholderGlass);

    const dummyGeometry = new THREE.CapsuleGeometry(0.22, 0.7, 4, 12);
    const dummyMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.65,
    });

    this.placeholderDummy = new THREE.Mesh(dummyGeometry, dummyMaterial);
    this.placeholderDummy.position.set(-1.3, 0.62, 0.25);
    this.placeholderDummy.castShadow = true;
    this.placeholderGroup.add(this.placeholderDummy);
  }

  loadModel() {
    const loader = new GLTFLoader();

    loader.load(
      '/models/portfolio_case_fan_animation.glb',
      (gltf) => {
        this.loadedModel = gltf.scene;
        this.scene.add(this.loadedModel);
        this.placeholderGroup.visible = false;

        this.loadedModel.traverse((object) => {
          if (object.name?.startsWith('CLICK_')) {
            this.setupClickTarget(object);
          } else if (object.isMesh) {
            this.setupVisibleMesh(object);
          }
        });

        FAN_CONFIGS.forEach((config) => {
          const configuredObject = this.loadedModel.getObjectByName(config.name);
          let containsMesh = false;

          configuredObject?.traverse((object) => {
            containsMesh ||= object.isMesh;
          });

          const rotorObject = containsMesh
            ? configuredObject
            : config.fallbackName
              ? this.loadedModel.getObjectByName(config.fallbackName)
              : null;

          if (rotorObject) {
            this.fanRotors.push({
              object: rotorObject,
              axis: config.axis,
            });
          } else {
            console.warn(`[FAN MISSING] ${config.name}`);
          }
        });

        this.hideLoadingScreen();
      },
      undefined,
      (error) => {
        console.warn(
          'GLB not found yet. The placeholder scene will remain visible.',
          error
        );
        this.hideLoadingScreen();
      }
    );
  }

  setupVisibleMesh(object) {
    object.castShadow = true;
    object.receiveShadow = true;

    if (object.material) {
      object.material.needsUpdate = true;
    }
  }

  setupClickTarget(object) {
    object.layers.set(CLICK_LAYER);
    object.userData.isClickTarget = true;

    object.userData.section = SECTION_BY_OBJECT[object.name] ?? {
      title: object.name,
      text: 'Section content not assigned yet.',
    };

    if (object.isMesh) {
      object.material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      });
    }

    this.clickTargets.push(object);
  }

  hideLoadingScreen() {
    this.loadingScreen?.classList.add('hidden');
  }

  toggleFans() {
    this.fanEnabled = !this.fanEnabled;
  }

  update(delta) {
    if (this.placeholderDummy) {
      this.placeholderDummy.rotation.y += 0.01;
    }

    const deltaTime = Math.min(delta, 100) / 1000;
    const targetSpeed = this.fanEnabled ? FAN_TARGET_SPEED : 0;
    const speedStep = FAN_ACCELERATION * deltaTime;

    if (this.fanCurrentSpeed < targetSpeed) {
      this.fanCurrentSpeed = Math.min(
        this.fanCurrentSpeed + speedStep,
        targetSpeed
      );
    } else if (this.fanCurrentSpeed > targetSpeed) {
      this.fanCurrentSpeed = Math.max(
        this.fanCurrentSpeed - speedStep,
        targetSpeed
      );
    }

    this.fanRotors.forEach((fan) => {
      fan.object.rotation[fan.axis] += this.fanCurrentSpeed * deltaTime;
    });
  }
}

export { CLICK_LAYER };
