import React, { useState } from 'react';
import styles from '../styles';
import { PROFILE_COLORS, PROFILE_ICONS } from '../config/constants';
import { PlayerProfileDisplay } from '../reusableComponents';

const ProfileCustomizationScreen = ({ user, onSave, userProfile }) => {
    const [selectedColor, setSelectedColor] = useState(userProfile.color || PROFILE_COLORS[0]); const [selectedIcon, setSelectedIcon] = useState(userProfile.icon || PROFILE_ICONS[0]); const [isSaving, setIsSaving] = useState(false);
    const handleSave = async () => { setIsSaving(true); await onSave(user, { color: selectedColor, icon: selectedIcon }); };
    return (<div style={styles.profileCustomizationContainer}><h2 style={styles.title}>¡BIENVENIDO, {user}!</h2><p style={{ textAlign: 'center', marginBottom: '30px', fontSize: '1.1rem' }}>Personaliza tu perfil para que todos te reconozcan.</p><div style={styles.formGroup}><label style={styles.label}>1. ELIGE TU COLOR</label><div style={styles.colorGrid}>{PROFILE_COLORS.map(color => { const isGradient = typeof color === 'string' && color.startsWith('linear-gradient'); const style = { ...styles.colorOption, ...(isGradient ? { background: color } : { backgroundColor: color }), ...(selectedColor === color ? styles.colorOptionSelected : {}) }; return (<div key={color} style={style} onClick={() => setSelectedColor(color)} />); })}</div></div><div style={styles.formGroup}><label style={styles.label}>2. ELIGE TU ICONO</label><div style={styles.iconGrid}>{PROFILE_ICONS.map(icon => (<div key={icon} style={{ ...styles.iconOption, ...(selectedIcon === icon ? styles.iconOptionSelected : {}) }} onClick={() => setSelectedIcon(icon)}>{icon}</div>))}</div></div><div style={{ textAlign: 'center', marginTop: '40px' }}><p style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Así se verá tu perfil:</p><PlayerProfileDisplay name={user} profile={{ color: selectedColor, icon: selectedIcon }} style={styles.profilePreview} /></div><button onClick={handleSave} disabled={isSaving} style={{ ...styles.mainButton, width: '100%' }}>{isSaving ? 'GUARDANDO...' : 'GUARDAR Y ENTRAR'}</button></div>);
};

export default ProfileCustomizationScreen;
