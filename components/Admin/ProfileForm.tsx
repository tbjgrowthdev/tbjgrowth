"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, changePassword } from "@/app/(admin)/actions/profile";
import { uploadImage } from "@/lib/cloudinary";
import { parseSocialLinks } from "@/lib/utils";
import ImageInput from "./Media/ImageInput";
import { Save, AlertCircle, CheckCircle2, KeyRound, User as UserIcon } from "lucide-react";
import { withToast } from "@/lib/admin/toast";

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  bio: string | null;
  socialLinks: string | null;
};

export default function ProfileForm({ user }: { user: AdminUser }) {
  const router = useRouter();
  const initialSocial = parseSocialLinks(user.socialLinks);

  const [formData, setFormData] = useState({
    name: user.name || "",
    email: user.email || "",
    bio: user.bio || "",
    image: user.image || "",
    website: initialSocial.website,
    twitter: initialSocial.twitter,
    linkedin: initialSocial.linkedin,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);


  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await withToast(updateProfile({
        name: formData.name,
        email: formData.email,
        bio: formData.bio,
        image: formData.image,
        socialLinks: JSON.stringify({
          website: formData.website,
          twitter: formData.twitter,
          linkedin: formData.linkedin,
        }),
      }), { success: "Profile updated", error: "Couldn't update profile" });

      if (result.success) {
        setSuccessMsg("Profile updated successfully.");
        router.refresh();
      } else {
        setError(result.error || "Failed to update profile");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-2">
            <CheckCircle2 size={20} />
            {successMsg}
          </div>
        )}

        <div className="bg-card p-6 rounded-xl shadow-sm border border-border space-y-6">
          <div className="flex items-center gap-3">
            <UserIcon size={20} className="text-caption" />
            <h2 className="text-xl font-bold text-foreground">Profile</h2>
          </div>

          <ImageInput
            label="Profile Photo"
            folder="Avatars"
            value={formData.image}
            onChange={(url) => setFormData((prev) => ({ ...prev, image: url }))}
            uploadFile={uploadImage}
            defaultAltText={formData.name}
            placeholder="Paste an image URL, or use the options below"
            previewClassName="w-20 h-20 rounded-full"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Full Name</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">Bio</label>
            <textarea
              name="bio"
              rows={3}
              value={formData.bio}
              onChange={handleChange}
              placeholder="A short bio shown on your author profile."
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
          <h2 className="text-xl font-bold text-foreground mb-2">Social Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Twitter / X</label>
              <input
                type="url"
                name="twitter"
                value={formData.twitter}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">LinkedIn</label>
              <input
                type="url"
                name="linkedin"
                value={formData.linkedin}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
          >
            <Save size={20} />
            {isSubmitting ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>

      <PasswordForm />
    </div>
  );
}

function PasswordForm() {
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await withToast(changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      }), { success: "Password changed", error: "Couldn't change password" });

      if (result.success) {
        setSuccessMsg("Password changed successfully.");
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setError(result.error || "Failed to change password");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={20} />
          {successMsg}
        </div>
      )}

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
        <div className="flex items-center gap-3">
          <KeyRound size={20} className="text-caption" />
          <h2 className="text-xl font-bold text-foreground">Change Password</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">Current Password</label>
          <input
            type="password"
            name="currentPassword"
            required
            value={passwordData.currentPassword}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">New Password</label>
            <input
              type="password"
              name="newPassword"
              required
              minLength={6}
              value={passwordData.newPassword}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              placeholder="Min. 6 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Confirm New Password</label>
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={6}
              value={passwordData.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
        >
          <KeyRound size={20} />
          {isSubmitting ? "Updating..." : "Update Password"}
        </button>
      </div>
    </form>
  );
}
