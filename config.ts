import { AppConfig } from './types';
import { DEFAULT_CONFIG } from './constants';

export const getConfig = async (configName: string): Promise<{ config: AppConfig, isNew: boolean }> => {
    const CONFIG_STORAGE_KEY = `pears_tryon_dev_config_${configName}`;

    try {
        const storedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (storedConfig) {
            const parsed = JSON.parse(storedConfig);
            if (parsed.garments && parsed.backgroundImages && parsed.brandAssets) {
                return { config: { ...DEFAULT_CONFIG, ...parsed }, isNew: false };
            }
        }
    } catch (error) {
        console.error("Failed to load config from localStorage", error);
    }
    return { config: DEFAULT_CONFIG, isNew: false };
};

export const saveConfig = async (config: AppConfig, configName: string) => {
    const CONFIG_STORAGE_KEY = `pears_tryon_dev_config_${configName}`;
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    alert(`Configuration '${configName}' saved to local browser storage.`);
};

export const resetConfig = async (configName: string) => {
    const CONFIG_STORAGE_KEY = `pears_tryon_dev_config_${configName}`;
    if (window.confirm(`Are you sure you want to reset the configuration for '${configName}' to the default settings?`)) {
        localStorage.removeItem(CONFIG_STORAGE_KEY);
        alert(`Configuration for '${configName}' has been reset to defaults.`);
    }
};
