# Face pulse method in this version

The camera stays on this computer. Frames are not written to the database and are not sent anywhere.

The worker finds one face, samples the forehead and both cheeks, and builds a red/green/blue time series. POS and CHROM each estimate a pulse rate inside the experimental band 0.7–2.2 Hz (42–132 bpm). GREEN is only a diagnostic. A number is stored as valid only when the usable signal is at least 8 seconds, the effective rate is at least 12 frames per second, the frames are fairly regular, the face is present for most of the recording, motion and exposure are acceptable, both color methods agree within 6 bpm, the stronger method has signal-to-noise of at least 0 dB, and the two halves of the recording agree within 8 bpm.

These gates are demonstration settings. They are not a medical standard, and the quality score is the fraction of gates that passed, not the probability that the pulse is correct.

The first prototype's finger readings and its decision to show a pulse at low quality are not used.
