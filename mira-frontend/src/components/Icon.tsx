/** @format */

import Image from "next/image";

interface IconProps {
	name: string;
	size?: number;
	alt?: string;
	className?: string;
}

export const Icon = ({
	name,
	size = 24,
	alt = name,
	className = "",
}: IconProps) => {
	// since files are named like "Property 1=Sun.svg"
	const fileName = `Property 1=${name}.svg`;

	return (
		<Image
			src={`/Icons/${fileName}`}
			alt={alt}
			width={size}
			height={size}
			className={`inline-block ${className}`}
		/>
	);
};
