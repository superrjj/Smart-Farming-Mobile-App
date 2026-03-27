import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { scale, fontScale } from '@/lib/responsive';

const colors = {
  brandGreen: '#22C55E',
  brandBlue: '#3B82F6',
  brandGrayText: '#6B7280',
  brandGrayBorder: '#E5E7EB',
  cardBg: '#F9FAFB',
  orange: '#F97316',
  purple: '#A855F7',
  red: '#EF4444',
};

const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

interface UserProfile {
  name: string;
  contactNumber: string;
  email: string;
  profilePicture?: string;
}

// Simple SHA-256 hashing function for React Native using expo-crypto
const sha256 = async (message: string): Promise<string> => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message
  );
};

export default function FarmerProfileScreen() {
  const params = useLocalSearchParams<{ email?: string; section?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const initialSection = typeof params.section === 'string' ? params.section : undefined;
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    contactNumber: '',
    email: email,
    profilePicture: '',
  });

  const [originalProfile, setOriginalProfile] = useState<UserProfile>({
    name: '',
    contactNumber: '',
    email: email,
    profilePicture: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showBasicInfoSection, setShowBasicInfoSection] = useState(false);
  const [showSettingsSection, setShowSettingsSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Farm Information states
  const [showFarmSection, setShowFarmSection] = useState(false);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [farmName, setFarmName] = useState('');
  const [farmLocation, setFarmLocation] = useState('');
  const [areaSize, setAreaSize] = useState('');
  const [cropType, setCropType] = useState('');
  const [savingFarmInfo, setSavingFarmInfo] = useState(false);
  const [originalFarmData, setOriginalFarmData] = useState({
    farmName: '',
    farmLocation: '',
    areaSize: '',
    cropType: '',
  });

  useEffect(() => {
    fetchProfile();
  }, [email]);

  // Open specific section when navigated from dashboard sidebar
  useEffect(() => {
    if (!initialSection) return;

    if (initialSection === 'basic') {
      setShowBasicInfoSection(true);
      setShowFarmSection(false);
      setShowPasswordSection(false);
      setShowSettingsSection(false);
    } else if (initialSection === 'farm') {
      setShowFarmSection(true);
      setShowBasicInfoSection(false);
      setShowPasswordSection(false);
      setShowSettingsSection(false);
    } else if (initialSection === 'password') {
      setShowPasswordSection(true);
      setShowBasicInfoSection(false);
      setShowFarmSection(false);
      setShowSettingsSection(false);
    } else if (initialSection === 'settings') {
      setShowSettingsSection(true);
      setShowBasicInfoSection(false);
      setShowFarmSection(false);
      setShowPasswordSection(false);
    }
  }, [initialSection]);

  const fetchProfile = async () => {
    if (!email) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (!error && data) {
        const profileData = {
          name: data.name || '',
          contactNumber: data.phone_number || '',
          email: data.email || email,
          profilePicture: data.profile_picture || '',
        };
        setProfile(profileData);
        setOriginalProfile(profileData);

        // Fetch farm data after getting user profile
        await fetchFarmData(data.id);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // New function to fetch farm data
  const fetchFarmData = async (userId: string) => {
    try {
      const { data: farmData, error: farmError } = await supabase
        .from('farm')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle();

      if (!farmError && farmData) {
        setFarmId(farmData.id);
        setFarmName(farmData.farm_name || '');
        setFarmLocation(farmData.location || '');
        setAreaSize(farmData.area_sqm?.toString() || '');
        setCropType(farmData.crop_type || '');
        
        // Store original farm data
        setOriginalFarmData({
          farmName: farmData.farm_name || '',
          farmLocation: farmData.location || '',
          areaSize: farmData.area_sqm?.toString() || '',
          cropType: farmData.crop_type || '',
        });
      }
    } catch (error) {
      console.error('Error fetching farm data:', error);
    }
  };

  const hasProfileChanges = () => {
    return (
      profile.name !== originalProfile.name ||
      profile.contactNumber !== originalProfile.contactNumber ||
      profile.profilePicture !== originalProfile.profilePicture
    );
  };

  const hasFarmInfoChanges = () => {
    return (
      farmName.trim() !== originalFarmData.farmName ||
      farmLocation.trim() !== originalFarmData.farmLocation ||
      areaSize.trim() !== originalFarmData.areaSize ||
      cropType.trim() !== originalFarmData.cropType
    );
  };

  const hasPasswordChanges = () => {
    return currentPassword !== '' || newPassword !== '' || confirmPassword !== '';
  };

  const handleSaveProfile = async () => {
    if (!profile.name.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    if (!profile.contactNumber.trim()) {
      Alert.alert('Error', 'Please enter your contact number');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          email: profile.email,
          name: profile.name.trim(),
          phone_number: profile.contactNumber.trim(),
          profile_picture: profile.profilePicture || null,
        }, {
          onConflict: 'email'
        });

      if (error) {
        console.error('Database save error:', error);
        Alert.alert('Error', `Failed to save profile: ${error.message}`);
      } else {
        Alert.alert('Success', 'Profile updated successfully');
        setOriginalProfile({...profile});
      }
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('Error', `Failed to save profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleBasicInfoSection = () => {
    setShowBasicInfoSection(!showBasicInfoSection);
    if (showPasswordSection) {
      setShowPasswordSection(false);
    }
    if (showSettingsSection) {
      setShowSettingsSection(false);
    }
    if (showFarmSection) {
      setShowFarmSection(false);
    }
  };

  const togglePasswordSection = () => {
    setShowPasswordSection(!showPasswordSection);
    if (showBasicInfoSection) {
      setShowBasicInfoSection(false);
    }
    if (showSettingsSection) {
      setShowSettingsSection(false);
    }
    if (showFarmSection) {
      setShowFarmSection(false);
    }
  };

  const toggleSettingsSection = () => {
    setShowSettingsSection(!showSettingsSection);
    if (showBasicInfoSection) {
      setShowBasicInfoSection(false);
    }
    if (showPasswordSection) {
      setShowPasswordSection(false);
    }
    if (showFarmSection) {
      setShowFarmSection(false);
    }
  };

  const toggleFarmSection = () => {
    setShowFarmSection(!showFarmSection);
    if (showBasicInfoSection) {
      setShowBasicInfoSection(false);
    }
    if (showPasswordSection) {
      setShowPasswordSection(false);
    }
    if (showSettingsSection) {
      setShowSettingsSection(false);
    }
  };

  const handleSettingPress = (setting: string) => {
    Alert.alert('Settings', `${setting} settings coming soon!`);
  };

  const handleSaveFarmInfo = async () => {
    if (!farmName.trim()) {
      Alert.alert('Error', 'Please enter farm name');
      return;
    }

    if (!farmLocation.trim()) {
      Alert.alert('Error', 'Please enter farm location');
      return;
    }

    if (!areaSize.trim()) {
      Alert.alert('Error', 'Please enter area size');
      return;
    }

    if (!cropType.trim()) {
      Alert.alert('Error', 'Please enter crop type');
      return;
    }

    setSavingFarmInfo(true);
    try {
      // Get the user's UUID from user_profiles using email
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        console.error('Error fetching user:', userError);
        Alert.alert('Error', 'User not found. Please complete your profile first.');
        setSavingFarmInfo(false);
        return;
      }

      const farmData = {
        owner_id: userData.id,
        farm_name: farmName.trim(),
        location: farmLocation.trim(),
        area_sqm: parseFloat(areaSize),
        crop_type: cropType.trim(),
      };
      
      let error;
      let savedData;

      // Check if updating existing farm or creating new one
      if (farmId) {
        // UPDATE existing farm
        const result = await supabase
          .from('farm')
          .update(farmData)
          .eq('id', farmId)
          .select()
          .single();
        
        error = result.error;
        savedData = result.data;
      } else {
        // INSERT new farm
        const result = await supabase
          .from('farm')
          .insert(farmData)
          .select()
          .single();
        
        error = result.error;
        savedData = result.data;
      }

      if (error) {
        console.error('Error saving farm info:', error);
        Alert.alert('Error', `Failed to save farm information: ${error.message}`);
        return;
      }

      // Update states with saved data
      if (savedData) {
        setFarmId(savedData.id);
        setFarmName(savedData.farm_name);
        setFarmLocation(savedData.location);
        setAreaSize(savedData.area_sqm.toString());
        setCropType(savedData.crop_type);

        // Update original data
        setOriginalFarmData({
          farmName: savedData.farm_name,
          farmLocation: savedData.location,
          areaSize: savedData.area_sqm.toString(),
          cropType: savedData.crop_type,
        });
      }

      Alert.alert('Success', `Farm information ${farmId ? 'updated' : 'saved'} successfully`);
    } catch (error) {
      console.error('Save farm info error:', error);
      Alert.alert('Error', 'Failed to save farm information');
    } finally {
      setSavingFarmInfo(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter your new password');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    try {
      const hashedCurrentPassword = await sha256(currentPassword);
      
      const { data: userData, error: fetchError } = await supabase
        .from('user_profiles')
        .select('password')
        .eq('email', email)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching user data:', fetchError);
        Alert.alert('Error', 'Failed to verify current password');
        return;
      }

      if (!userData || !userData.password) {
        Alert.alert('Error', 'User account not found or no password set');
        return;
      }

      if (userData.password !== hashedCurrentPassword) {
        Alert.alert('Error', 'Current password is incorrect');
        return;
      }

      const hashedNewPassword = await sha256(newPassword);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          password: hashedNewPassword
        })
        .eq('email', email);

      if (updateError) {
        console.error('Error updating password:', updateError);
        Alert.alert('Error', 'Failed to update password');
        return;
      }

      Alert.alert('Success', 'Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
      
    } catch (error) {
      console.error('Password change error:', error);
      Alert.alert('Error', 'Failed to update password');
    }
  };

  const pickImage = async (source: 'camera' | 'library') => {
    const permissionResult = source === 'camera' 
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission required', `Permission to access ${source === 'camera' ? 'camera' : 'photo library'} is required!`);
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });

    if (!result.canceled && result.assets[0]) {
      uploadImage(result.assets[0].uri);
    }
  };

 const uploadImage = async (uri: string) => {
  setUploadingImage(true);
  try {
    console.log('Starting image upload for:', uri);
    
    const formData = new FormData();
    
    const fileExtension = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const userId = email.replace(/[@.]/g, '-');
    const fileName = `farmer_profile_pictures/${userId}/profile-${Date.now()}.${fileExtension}`;
    
    const file = {
      uri: uri,
      type: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
      name: fileName.split('/').pop() || 'profile.jpg',
    } as any;
    
    formData.append('file', file);
    
    console.log('Uploading file:', fileName);
    
    // FIXED: Use the supabase anon key directly
    const supabaseUrl = 'https://xzouepokakzubwjogmdr.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6b3VlcG9rYWt6dWJ3am9nbWRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODY3MTUsImV4cCI6MjA4MDg2MjcxNX0.kqvEprlsrAmFt6qYTNDPvhWpAsLJJU_oKf-kIhlf2bc';
    
    // Upload using fetch with FormData
    const uploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/images/${fileName}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`, 
        },
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload failed:', errorText);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
      setUploadingImage(false);
      return;
    }

    console.log('Upload successful');
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(fileName);

    console.log('Public URL:', publicUrl);
    
    // Wait a moment for the file to be fully available
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Save the profile picture URL to the database
    const { error: dbError } = await supabase
      .from('user_profiles')
      .upsert({
        email: profile.email,
        name: profile.name.trim() || 'Farmer',
        phone_number: profile.contactNumber.trim() || '',
        profile_picture: publicUrl,
      }, {
        onConflict: 'email'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      Alert.alert('Error', 'Image uploaded but failed to save to profile');
      setUploadingImage(false);
      return;
    }
    
    // Update local state
    setProfile({ ...profile, profilePicture: publicUrl });
    
    Alert.alert('Success', 'Profile picture updated successfully');
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Alert.alert('Error', `Failed to upload image: ${errorMessage}`);
  } finally {
    setUploadingImage(false);
  }
};

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandBlue} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={20} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Farmer Profile</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Picture Card */}
          <View style={styles.card}>
            <View style={styles.profilePicHeader}>
              <Text style={styles.cardTitle}>Profile Picture</Text>
            </View>

            <View style={styles.profilePicSection}>
              <View style={styles.profilePicContainer}>
                {profile.profilePicture ? (
                  <Image
                    source={{ uri: profile.profilePicture }}
                    style={styles.profilePicImage}
                    onError={(e) => {
                      console.log('Image failed to load:', profile.profilePicture);
                      console.log('Error details:', e.nativeEvent.error);
                    }}
                    onLoad={() => console.log('Image loaded successfully:', profile.profilePicture)}
                  />
                ) : (
                  <View style={styles.profilePicPlaceholder}>
                    <FontAwesome name="user" size={40} color={colors.brandGrayText} />
                  </View>
                )}
              </View>

              <View style={styles.profilePicButtons}>
                <TouchableOpacity
                  style={[styles.profilePicButton, styles.cameraButton]}
                  onPress={() => pickImage('camera')}
                  disabled={uploadingImage}
                >
                  <FontAwesome name="camera" size={16} color="#fff" />
                  <Text style={styles.profilePicButtonText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.profilePicButton, styles.galleryButton]}
                  onPress={() => pickImage('library')}
                  disabled={uploadingImage}
                >
                  <FontAwesome name="image" size={16} color="#fff" />
                  <Text style={styles.profilePicButtonText}>Choose Photo</Text>
                </TouchableOpacity>
              </View>

              {uploadingImage && (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="small" color={colors.brandBlue} />
                  <Text style={styles.uploadingText}>Uploading photo...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Basic Information Card */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.basicInfoHeader}
              onPress={toggleBasicInfoSection}
            >
              <View style={styles.sectionHeaderLeft}>
                <FontAwesome name="user" size={18} color={colors.brandGrayText} />
                <Text style={styles.cardTitle}>Basic Information</Text>
              </View>
              <FontAwesome
                name={showBasicInfoSection ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.brandGrayText}
              />
            </TouchableOpacity>

            {showBasicInfoSection && (
              <View style={styles.basicInfoSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Farmer Name</Text>
                  <TextInput
                    style={styles.input}
                    value={profile.name}
                    onChangeText={(text) => setProfile({ ...profile, name: text })}
                    placeholder="Enter your full name"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Contact Number</Text>
                  <TextInput
                    style={styles.input}
                    value={profile.contactNumber}
                    onChangeText={(text) => {
                      // Only allow numbers and limit to 11 digits
                      const numericText = text.replace(/[^0-9]/g, '');
                      setProfile({ ...profile, contactNumber: numericText.slice(0, 11) });
                    }}
                    placeholder="Enter mobile number"
                    keyboardType="phone-pad"
                    maxLength={11}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={profile.email}
                    editable={false}
                  />
                </View>

                {/* Save Profile Button inside Basic Information */}
                <TouchableOpacity
                  style={[styles.saveButton, (!hasProfileChanges() || saving) && styles.saveButtonDisabled]}
                  onPress={handleSaveProfile}
                  disabled={!hasProfileChanges() || saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Information</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

        {/* Farm Information Card */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.farmHeader}
            onPress={toggleFarmSection}
          >
            <View style={styles.sectionHeaderLeft}>
              <FontAwesome name="leaf" size={18} color={colors.brandGrayText} />
              <Text style={styles.cardTitle}>Farm Information</Text>
            </View>
            <FontAwesome
              name={showFarmSection ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.brandGrayText}
            />
          </TouchableOpacity>

          {showFarmSection && (
            <View style={styles.farmSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Farm Name</Text>
                <TextInput
                  style={styles.input}
                  value={farmName}
                  onChangeText={setFarmName}
                  placeholder="Enter farm name"
                  placeholderTextColor={colors.brandGrayText}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Farm Location</Text>
                <TextInput
                  style={styles.input}
                  value={farmLocation}
                  onChangeText={setFarmLocation}
                  placeholder="Enter farm location"
                  placeholderTextColor={colors.brandGrayText}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Area Size (hectares)</Text>
                <TextInput
                  style={styles.input}
                  value={areaSize}
                  onChangeText={setAreaSize}
                  placeholder="Enter area size"
                  placeholderTextColor={colors.brandGrayText}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Crop Type</Text>
                <TextInput
                  style={styles.input}
                  value={cropType}
                  onChangeText={setCropType}
                  placeholder="Enter crop type"
                  placeholderTextColor={colors.brandGrayText}
                />
              </View>

              {/* Save Farm Information Button - WITH VALIDATION */}
              <TouchableOpacity
                style={[styles.saveFarmButton, (!hasFarmInfoChanges() || savingFarmInfo) && styles.saveButtonDisabled]}
                onPress={handleSaveFarmInfo}
                disabled={!hasFarmInfoChanges() || savingFarmInfo}
              >
                {savingFarmInfo ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Farm Information</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

          {/* Password Change Card */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.passwordHeader}
              onPress={togglePasswordSection}
            >
              <View style={styles.sectionHeaderLeft}>
                <FontAwesome name="lock" size={18} color={colors.brandGrayText} />
                <Text style={styles.cardTitle}>Change Password</Text>
              </View>
              <FontAwesome
                name={showPasswordSection ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.brandGrayText}
              />
            </TouchableOpacity>

            {showPasswordSection && (
              <View style={styles.passwordSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Current Password</Text>
                  <TextInput
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor={colors.brandGrayText}
                    secureTextEntry
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password (min 6 chars)"
                    placeholderTextColor={colors.brandGrayText}
                    secureTextEntry
                  />
                </View>


                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.brandGrayText}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={[styles.changePasswordButton, !hasPasswordChanges() && styles.saveButtonDisabled]}
                  onPress={handleChangePassword}
                  disabled={!hasPasswordChanges()}
                >
                  <Text style={styles.changePasswordButtonText}>Update Password</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Settings Card */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.settingsHeader}
              onPress={toggleSettingsSection}
            >
              <View style={styles.sectionHeaderLeft}>
                <FontAwesome name="cog" size={18} color={colors.brandGrayText} />
                <Text style={styles.cardTitle}>Settings</Text>
              </View>
              <FontAwesome
                name={showSettingsSection ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.brandGrayText}
              />
            </TouchableOpacity>

            {showSettingsSection && (
              <View style={styles.settingsSection}>
                
                <TouchableOpacity style={styles.settingItem} onPress={() => handleSettingPress('language')}>
                  <View style={styles.settingItemLeft}>
                    <FontAwesome name="language" size={18} color={colors.brandGrayText} />
                    <Text style={styles.settingItemText}>Language</Text>
                  </View>
                  <FontAwesome name="chevron-right" size={16} color={colors.brandGrayText} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem} onPress={() => handleSettingPress('about')}>
                  <View style={styles.settingItemLeft}>
                    <FontAwesome name="info-circle" size={18} color={colors.brandGrayText} />
                    <Text style={styles.settingItemText}>About</Text>
                  </View>
                  <FontAwesome name="chevron-right" size={16} color={colors.brandGrayText} />
                </TouchableOpacity>
              </View>
            )}
          </View>

         
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.brandGrayText,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brandGrayBorder,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: '#000',
  },
  headerRight: {
    width: 28,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: '#1F2937',
  },
  profilePicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  basicInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  farmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profilePicSection: {
    marginTop: 16,
  },
  profilePicContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profilePicImage: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    borderWidth: 3,
    borderColor: colors.brandGrayBorder,
  },
  profilePicPlaceholder: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    backgroundColor: '#F3F4F6',
    borderWidth: 3,
    borderColor: colors.brandGrayBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  profilePicButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  cameraButton: {
    backgroundColor: colors.brandBlue,
  },
  galleryButton: {
    backgroundColor: colors.brandGreen,
  },
  profilePicButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontScale(14),
    color: '#fff',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  uploadingText: {
    fontFamily: fonts.medium,
    fontSize: fontScale(14),
    color: colors.brandGrayText,
  },
  basicInfoSection: {
    marginTop: 16,
  },
  farmSection: {
    marginTop: 16,
  },
  passwordSection: {
    marginTop: 16,
  },
  settingsSection: {
    marginTop: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.brandGrayBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 15,
    letterSpacing: 0,
    color: '#1F2937',
    backgroundColor: '#fff',
  },
  disabledInput: {
    backgroundColor: '#F9FAFB',
    color: colors.brandGrayText,
  },
  saveButton: {
    backgroundColor: colors.brandGreen,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveFarmButton: {
    backgroundColor: colors.brandGreen,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: colors.brandGrayText,
  },
  saveButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: '#fff',
  },
  changePasswordButton: {
    backgroundColor: colors.brandBlue,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  changePasswordButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: '#fff',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.brandGrayBorder,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingItemText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: '#1F2937',
  },
});