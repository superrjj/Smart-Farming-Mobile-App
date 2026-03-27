// Quick test to debug sensor_reading query
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzouepokakzubwjogmdr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6b3VlcG9rYWt6dWJ3am9nbWRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODY3MTUsImV4cCI6MjA4MDg2MjcxNX0.kqvEprlsrAmFt6qYTNDPvhWpAsLJJU_oKf-kIhlf2bc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('--- Testing sensor_reading table ---');
  
  // Test 1: Simple select all (limit 5)
  const { data: allData, error: allError } = await supabase
    .from('sensor_reading')
    .select('*')
    .limit(5);
  
  console.log('Test 1 - Select all (limit 5):');
  console.log('  Error:', allError);
  console.log('  Data:', JSON.stringify(allData, null, 2));
  
  // Test 2: Filter by sensor_id = 1
  const { data: tempData, error: tempError } = await supabase
    .from('sensor_reading')
    .select('*')
    .eq('sensor_id', 1)
    .order('timestamp', { ascending: false })
    .limit(3);
  
  console.log('\nTest 2 - sensor_id=1 (temperature):');
  console.log('  Error:', tempError);
  console.log('  Data:', JSON.stringify(tempData, null, 2));

  // Test 3: Check column names
  const { data: oneRow, error: oneError } = await supabase
    .from('sensor_reading')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  console.log('\nTest 3 - Single row (check column names):');
  console.log('  Error:', oneError);
  if (oneRow) {
    console.log('  Column names:', Object.keys(oneRow));
    console.log('  Row:', oneRow);
  } else {
    console.log('  No data returned (likely RLS blocking)');
  }
}

test();
