import Link from "next/link";

export function PrivateNamesNotice({
  username,
  previewing,
}: {
  username: string;
  previewing: boolean;
}) {
  if (previewing) {
    return (
      <p className="private-names-notice">
        This is what everyone else sees. Private repos show as code names with
        no link. <Link href={`/${username}`}>Back to your view</Link>
      </p>
    );
  }

  return (
    <p className="private-names-notice">
      You see your private repo names only because you&apos;re signed in as @
      {username}. Everyone else, and every share image, gets a code name like
      Stellar Voyager 7f3 with no link.{" "}
      <Link href={`/${username}?view=public`}>See what others see</Link>
    </p>
  );
}
