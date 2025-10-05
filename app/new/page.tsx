'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import notionData from '@/data/notion-data.json';

interface Resource {
  id: string;
  name: string;
  resourceType: string;
  description: string | null;
  eligibility: string | null;
  link: string | null;
  importantDates: string | null;
  uscExternal: string;
}

const resourceTypeColors: Record<string, string> = {
  'Newsletters': 'bg-red-100 text-red-700 hover:bg-red-100',
  'Sources of Funding/Competitions': 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  'Networking': 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  'Resource Library': 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
  'Clubs': 'bg-lime-100 text-lime-700 hover:bg-lime-100',
  'Mentorship': 'bg-green-100 text-green-700 hover:bg-green-100',
  'Accelerators': 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  'Pitch Events': 'bg-teal-100 text-teal-700 hover:bg-teal-100',
  'Curricular': 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100',
  'General Startup': 'bg-sky-100 text-sky-700 hover:bg-sky-100',
  'Fundraising': 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  'Legal': 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100',
  'Incorporation': 'bg-violet-100 text-violet-700 hover:bg-violet-100',
  'USC-Affiliated External Resources': 'bg-purple-100 text-purple-700 hover:bg-purple-100',
  'Angel Syndicates': 'bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100',
  'International Founder': 'bg-pink-100 text-pink-700 hover:bg-pink-100',
  'Putting together your first round': 'bg-rose-100 text-rose-700 hover:bg-rose-100',
};

export default function NewPage() {
  const resources = notionData as Resource[];
  const [searchQuery, setSearchQuery] = useState('');

  const filteredResources = resources
    .filter((resource) => {
      const query = searchQuery.toLowerCase();
      const matchesName = resource.name?.toLowerCase().includes(query);
      const matchesDescription = resource.description?.toLowerCase().includes(query);
      return matchesName || matchesDescription;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-[#990000] py-6 px-8 mb-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-[#FFCC00]">USC Entrepreneurship Resources</h1>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-8">
        <div className="mb-6">
          <Input
            type="text"
            placeholder="Search resources by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b">
              <TableHead className="font-medium w-16"></TableHead>
              <TableHead className="font-medium">Name</TableHead>
              <TableHead className="font-medium">Resource Type</TableHead>
              <TableHead className="font-medium">Description</TableHead>
              <TableHead className="font-medium">Eligibility</TableHead>
              <TableHead className="font-medium">USC/External</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResources.map((resource) => (
              <TableRow key={resource.id} className="border-b">
                <TableCell>
                  {resource.link ? (
                    <a 
                      href={resource.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex items-center justify-center hover:bg-gray-200 transition-colors">
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${resource.link}&sz=128`}
                          alt=""
                          className="w-6 h-6 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </a>
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                      <div className="w-6 h-6 bg-gray-300 rounded"></div>
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {resource.link ? (
                    <a 
                      href={resource.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 transition-colors"
                    >
                      {resource.name}
                    </a>
                  ) : (
                    resource.name
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={resourceTypeColors[resource.resourceType] || 'bg-gray-100 text-gray-700 hover:bg-gray-100'}>
                    {resource.resourceType}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-600">{resource.description || ''}</TableCell>
                <TableCell className="text-sm text-gray-600">{resource.eligibility || ''}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">
                    {resource.uscExternal}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

