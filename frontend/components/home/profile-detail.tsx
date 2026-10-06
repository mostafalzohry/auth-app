const ProfileDetail = ({ label, value }: { label: string; value: string }) => {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
};

export default ProfileDetail;
