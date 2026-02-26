import React, { FC } from 'react';
import { IconTarget, IconSpinner } from './Icons';

interface CalibrationPaneProps {
    onCalibrate: () => void;
    isPoseDetected: boolean;
}

export const CalibrationPane: FC<CalibrationPaneProps> = ({ onCalibrate, isPoseDetected }) => {
    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
            <div className="glassmorphic p-8 rounded-2xl text-center flex flex-col items-center max-w-sm animate-fade-in-up">
                <IconTarget className="w-16 h-16 text-lime-400 mb-4" />
                <h2 className="text-2xl font-bold text-white">Ready to Dance?</h2>
                <p className="text-zinc-300 mt-2 mb-6">
                    Stand back so your full body is visible, strike a T-pose (arms straight out to the sides), and hit calibrate.
                </p>
                <button
                    onClick={onCalibrate}
                    disabled={!isPoseDetected}
                    className="btn-primary px-8 py-4 text-lg w-full flex items-center justify-center space-x-2 disabled:bg-lime-400/50 disabled:cursor-not-allowed"
                >
                    {isPoseDetected ? (
                         <span>Calibrate</span>
                    ) : (
                        <>
                            <IconSpinner className="w-5 h-5 animate-spin"/>
                            <span>Finding Pose...</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};