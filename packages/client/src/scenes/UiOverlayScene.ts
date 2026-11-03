import * as Phaser from "phaser";
import { SCENES } from "../app/scenes";

/**
 * Transparent scene kept running above everything else. Hosts toasts so they survive scene
 * transitions. It has no input of its own except toasts (click to dismiss).
 */
export class UiOverlayScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.uiOverlay });
  }

  create(): void {
    this.input.topOnly = true;
  }
}
