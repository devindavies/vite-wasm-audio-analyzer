use std::cell::RefCell;

use spectrum_analyzer::scaling::SpectrumDataStats;
use spectrum_analyzer::windows::hann_window;
use spectrum_analyzer::{samples_fft_to_spectrum, FrequencyLimit};
use wasm_bindgen::prelude::*;
mod utils;

#[wasm_bindgen(getter_with_clone)]
pub struct WasmSpectrumAnalyzer {
    visualize_spectrum: RefCell<Vec<(f64, f64)>>,
    sample_rate: u32,
    fft_size: usize,
}

fn normalize(fr_val: f32, _stats: &SpectrumDataStats) -> f32 {
    debug_assert!(!fr_val.is_infinite());
    debug_assert!(!fr_val.is_nan());
    debug_assert!(fr_val >= 0.0);

    // if stats.n == 0.0 {
    //     20.0 * libm::log10f(2.0 * &fr_val)
    // } else {
    //     20.0 * libm::log10f(2.0 * &fr_val / stats.n)
    // }
    fr_val
}

#[wasm_bindgen]
impl WasmSpectrumAnalyzer {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: u32, fft_size: usize) -> Self {
        utils::set_panic_hook();

        WasmSpectrumAnalyzer {
            sample_rate,
            fft_size,
            visualize_spectrum: RefCell::new(vec![(0.0, 0.0); fft_size / 2]),
        }
    }

    pub fn analyze(&mut self, audio_samples: Vec<f32>, min_freq: u32, max_freq: u32) -> Vec<f32> {
        if audio_samples.len() < self.fft_size {
            panic!("Insufficient samples passed to analyze(). Expected an array containing {} elements but got {}", self.fft_size, audio_samples.len());
        }
        // Contains the data for the spectrum to be visualized. It contains ordered pairs of
        // `(frequency, frequency_value)`. During each iteration, the frequency value gets
        // combined with `max(old_value * smoothing_factor, new_value)`.

        let hann_window = hann_window(&audio_samples[..self.fft_size]);

        // calc spectrum
        let latest_spectrum = samples_fft_to_spectrum(
            // (windowed) samples
            &hann_window,
            // sampling rate
            self.sample_rate,
            // optional frequency limit: e.g. only interested in frequencies 50 <= f <= 150?
            FrequencyLimit::Range(min_freq as f32, max_freq as f32),
            // optional scale
            Some(&normalize),
        )
        .unwrap();

        latest_spectrum
            .data()
            .iter()
            .zip(self.visualize_spectrum.borrow_mut().iter_mut())
            .for_each(|((fr_new, fr_val_new), (fr_old, fr_val_old))| {
                // actually only required in very first iteration
                *fr_old = fr_new.val() as f64;

                let old_val = *fr_val_old * 0.9;

                let new_val = fr_val_new.val() * 0.1;

                *fr_val_old = old_val + new_val as f64;
            });

        let window = self
            .visualize_spectrum
            .borrow()
            .clone()
            .iter()
            .map(|&(_frequency, value)| value as f32)
            .collect();

        window
    }
}
